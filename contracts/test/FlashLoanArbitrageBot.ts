import { expect } from "chai";
import { ethers, network } from "hardhat";
import { deployContracts, Contracts } from "../scripts/deploy";
import { networkConfig } from "../helper-hardhat-config";

const USDC = "0x7f5c764cbc14f9669b88837ca1490cca17c31607";
const WETH = "0x4200000000000000000000000000000000000006";

const mapToDecimals = {
  "dai": "1000000000000000000",
  "usdc": "1000000",
  "weth": "1000000000000000000",
}

const chainId = network.config.chainId;

/**
 * 
 * @param dexAddress - address of the dex where to dump weth
 * @param props - properties of the test
 */
async function makeArbitrageOpportunity(dexAddress: string, ethToSwap: BigInt, props: any) {

  const { finder, tradeExecutor, executor, wethToken, usdcToken, deployer, arbitrageGuy } = props;

  await tradeExecutor.getWethFromEth(networkConfig[chainId]["weth"], { value: ethToSwap });
  console.log("Before swap %s", await wethToken.balanceOf(deployer.address));
  console.log("Before swap %s", await usdcToken.balanceOf(deployer.address));
  await finder.establishUniswapPrice(wethToken.target, usdcToken.target);
  let uniswapPrice = await finder.getUniswapPrice();
  let veloPrice = await finder.getVeloSwapPrice(wethToken.target, usdcToken.target);
  console.log(((10 ** 18) / (+mapToDecimals["usdc"])));
  let price = +ethers.formatEther(uniswapPrice.toString());
  console.log("Uniswap price before: ", price * ((10 ** 18) / (+mapToDecimals["usdc"])));
  price = +ethers.formatEther(veloPrice.toString());
  console.log("Velo price before: ", price * ((10 ** 18) / (+mapToDecimals["usdc"])));

  console.log("Making arbitrage opportunity...");
  await wethToken.approve(tradeExecutor.target, ethToSwap);
  await tradeExecutor.executeTrade(dexAddress, wethToken.target, usdcToken.target, ethToSwap);

  console.log("After swap %s", await wethToken.balanceOf(deployer.address));
  console.log("After swap %s", await usdcToken.balanceOf(deployer.address));
  await finder.establishUniswapPrice(wethToken.target, usdcToken.target);
  uniswapPrice = await finder.getUniswapPrice();
  veloPrice = await finder.getVeloSwapPrice(wethToken.target, usdcToken.target);
  price = +ethers.formatEther(uniswapPrice.toString());
  console.log("Uniswap price after: ", price * ((10 ** 18) / (+mapToDecimals["usdc"])));
  price = +ethers.formatEther(veloPrice.toString());
  console.log("Velo price after: ", price * ((10 ** 18) / (+mapToDecimals["usdc"])));
  return { uniswapPrice, veloPrice };
}

describe("Flash Loan Arbitrage Bot", function () {
  async function bootstrap(): Promise<Contracts> {
    const [signer] = await ethers.getSigners();
    const provider = ethers.provider;
    const signerBalance = await provider.getBalance(signer.address);

    console.log(
      `starting the deployment script, will deploy multiple contracts to the network: '${network.name}', 
     with owner set to: '${signer.address}', balance: '${signerBalance}'`
    );

    const contracts = await deployContracts();
    return contracts;
  }

  it("Should pass", async function () {
    const { bot } = await bootstrap();
    const [signer] = await ethers.getSigners();
    const addr = await signer.getAddress();

    await bot.addToWhitelist(addr);
    console.log("signer is whitelisted: ", await bot.isWhitelisted(addr));

    await bot.execute(WETH, USDC);

    await bot.on(bot.getEvent("ArbitrageOpportunity"), async (isFound: any) => {
      expect(isFound).to.equal(false);
    });
  });
  it("2. should find arbitrage opportunity", async () => {

    const { bot, executor, finder, tradeExecutor } = await bootstrap();
    /* Get the signers */
    const [deployer, arbitrageGuy] = await ethers.getSigners();
    const uniswapRouterAddress = networkConfig[chainId]["uniswap_router_v3"];
    const wethToken = await ethers.getContractAt("IERC20", networkConfig[chainId]["weth"]);
    const usdcToken = await ethers.getContractAt("IERC20", networkConfig[chainId]["usdc"]);

    const tokenToBorrow = ethers.parseEther("0.000000002");

    // Access control
    await finder.addToWhitelist(deployer.address);
    await tradeExecutor.addToWhitelist(deployer.address);

    // Make arbitrage opportunity
    const { uniswapPrice, veloPrice } = await makeArbitrageOpportunity(uniswapRouterAddress, ethers.parseEther("140"), { finder, tradeExecutor, executor, wethToken, usdcToken, deployer, arbitrageGuy });

    // Call the find function
    const response = await finder.find(usdcToken.target, wethToken.target);

    // Assert the result
    expect(response[0]).to.be.true;
    console.log("Opportunity: ", response[1]);
    // console.log("2 .opportunity: ", opportunity[0]);

    // Perform flashloan arbitrage - create a function here
    let beforeWethBalance = await wethToken.balanceOf(executor.target);
    let beforeUsdcBalance = await usdcToken.balanceOf(executor.target);
    console.log("Contract Balances:\nwethBalance: %s\tusdcBalance: %s\n", ethers.formatUnits(beforeWethBalance, 18).toString(), ethers.formatUnits(beforeUsdcBalance, 6).toString());
    beforeWethBalance = await wethToken.balanceOf(arbitrageGuy.address);
    beforeUsdcBalance = await usdcToken.balanceOf(arbitrageGuy.address);
    console.log("ArbitrageGuy balances:\nwethBalance: %s\tusdcBalance: %s\n", ethers.formatUnits(beforeWethBalance, 18).toString(), ethers.formatUnits(beforeUsdcBalance, 6).toString());
    await executor.addToWhitelist(arbitrageGuy.address);
    await tradeExecutor.addToWhitelist(executor.target);
    await executor.connect(arbitrageGuy).execute(response[1][0][0], response[1][0][1], response[1][0][2], response[1][1][2], tokenToBorrow);
    let afterWethBalance = await wethToken.balanceOf(executor.target);
    let afterUsdcBalance = await usdcToken.balanceOf(executor.target);
    console.log("Contract Balances:\nwethBalance: %s\tusdcBalance: %s\n", ethers.formatUnits(afterWethBalance, 18).toString(), ethers.formatUnits(afterUsdcBalance, 6).toString());
    await executor.connect(arbitrageGuy).withdrawProfit(usdcToken.target);
    afterWethBalance = await wethToken.balanceOf(arbitrageGuy.address);
    afterUsdcBalance = await usdcToken.balanceOf(arbitrageGuy.address);
    console.log("ArbitrageGuy balances:\nwethBalance: %s\tusdcBalance: %s\n", ethers.formatUnits(afterWethBalance, 18).toString(), ethers.formatUnits(afterUsdcBalance, 6).toString());
    expect(afterUsdcBalance > beforeUsdcBalance).to.be.true;
    // You can add more assertions based on your contract's logic
  });
});
