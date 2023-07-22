import { expect } from "chai";
import { ethers, network } from "hardhat";
import { ArbitrageFinder } from "../typechain-types/contracts/ArbitrageFinder"; // Update the path to the generated contract types
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { networkConfig } from "../helper-hardhat-config";


const mapToDecimals = {
  "dai": "1000000000000000000",
  "usdc": "1000000",
  "weth": "1000000000000000000",
}
// describe("Flash Loan Arbitrage Bot", function () {
//   it("Should pass", async function () {

//     const veloRouter = 
//     const sushiswapRouter = 


//     const arbitrageEngineFactory = await ethers.getContractFactory("ArbitrageEngine");
//     const arbitrageEngine = await arbitrageEngineFactory
//       .connect(deployer)
//       .deploy();
//     const tradeExecutorFactory = await ethers.getContractFactory("TradeExecutor");
//     const tradeExecutor = await tradeExecutorFactory
//       .connect(deployer)
//       .deploy();

//     console.log("ArbitrageEngine deployed to:", await arbitrageEngine.getAddress());
//     console.log("TradeExecutor deployed to:", await tradeExecutor.getAddress());
//     console.log(`${chainId} network config: ${networkConfig[chainId]["uniswap_router_v2"]}`);

//     let isOpportunity = await arbitrageEngine.checkArbitrageOpportunity(
//       veloRouter, sushiswapRouter, weth, dai);
//     console.log("isOpportunity: ", isOpportunity);

//     console.log("Getting weth from eth...")
//     const balanceOfWeth = await tradeExecutor.getWethFromEth(weth, { value: ethers.BigNumber.from("1000000000000000000") });
//     console.log("Your balance of weth is: ", balanceOfWeth);

//     // Make arbitrage opportunity 


//     expect(true).to.equal(true);
//   });
// });


const chainId = network.config.chainId;

describe("ArbitrageFinder", () => {
  const uniswapRouterAddress = networkConfig[chainId]["uniswap_router_v3"];; // Replace with the actual address
  const veloRouterAddress = networkConfig[chainId]["velo_router_v2"];; // Replace with the actual address
  const sushiSwapRouterAddress = networkConfig[chainId]["sushiswap_router_v2"];; // Replace with the actual address

  async function beforeIt(): Promise<any> {
    /* Get the signers */
    const [deployer, arbitrageGuy] = await ethers.getSigners();

    // Replace these addresses with actual token addresses you want to test
    const token1 = networkConfig[chainId]["usdc"];
    const token2 = networkConfig[chainId]["weth"];

    /* Initialization of addresses independent on the network */
    // Deploy the contracts
    const TradeExecutor = await ethers.getContractFactory("TradeExecutor");
    const ArbitrageFinder = await ethers.getContractFactory("ArbitrageFinder");
    const ArbitrageExecutor = await ethers.getContractFactory("ArbitrageExecutor");
    const wethToken = await ethers.getContractAt("IWeth", token2);
    const usdcToken = await ethers.getContractAt("IERC20", token1);
    const tradeExecutor = await TradeExecutor
      .connect(deployer)
      .deploy();
    const arbitrageFinder = await ArbitrageFinder
      .connect(deployer)
      .deploy(uniswapRouterAddress, veloRouterAddress);
    const arbitrageExecutor = await ArbitrageExecutor
      .connect(arbitrageGuy)
      .deploy("0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb", tradeExecutor.target);

    return { arbitrageFinder, tradeExecutor, arbitrageExecutor, wethToken, usdcToken: usdcToken, deployer, arbitrageGuy };
  };
  it("1. should not find arbitrage opportunity", async () => {
    const { arbitrageFinder, tradeExecutor, arbitrageExecutor, wethToken, usdcToken: usdcToken, deployer, arbitrageGuy } = await beforeIt();

    // Call the find function
    await arbitrageFinder.addToWhitelist(deployer.address);
    await tradeExecutor.addToWhitelist(deployer.address);
    await arbitrageFinder.establishUniswapPrice(wethToken.target, usdcToken.target);
    let uniswapPrice = await arbitrageFinder.getUniswapPrice();
    let veloPrice = await arbitrageFinder.getVeloSwapPrice(wethToken.target, usdcToken.target);
    const [found, opportunity] = await arbitrageFinder.find(usdcToken.target, wethToken.target, uniswapPrice, veloPrice);
    console.log("2. opportunity: ", opportunity);
    // Assert the result
    expect(found).to.be.false;
    //expect(opportunity).to.be.undefined;
    // You can add more assertions based on your contract's logic
  });

  it("2. should find arbitrage opportunity", async () => {

    const { arbitrageFinder, tradeExecutor, wethToken, arbitrageExecutor, usdcToken, deployer, arbitrageGuy } = await beforeIt();
    const ethToSwap = ethers.parseEther("10");

    // Call the find function
    await arbitrageFinder.addToWhitelist(deployer.address);
    await tradeExecutor.addToWhitelist(deployer.address);
    await tradeExecutor.getWethFromEth(networkConfig[chainId]["weth"], { value: ethToSwap });
    /* Make arbitrage opportunity */
    console.log("Before swap %s", await wethToken.balanceOf(deployer.address));
    console.log("Before swap %s", await usdcToken.balanceOf(deployer.address));
    await arbitrageFinder.establishUniswapPrice(wethToken.target, usdcToken.target);
    let uniswapPrice = await arbitrageFinder.getUniswapPrice();
    let veloPrice = await arbitrageFinder.getVeloSwapPrice(wethToken.target, usdcToken.target);
    console.log(((10 ** 18) / (+mapToDecimals["usdc"])));
    let price = +ethers.formatEther(uniswapPrice.toString());
    console.log("Uniswap price before: ", price * ((10 ** 18) / (+mapToDecimals["usdc"])));
    price = +ethers.formatEther(veloPrice.toString());
    console.log("Velo price before: ", price * ((10 ** 18) / (+mapToDecimals["usdc"])));

    console.log("Making arbitrage opportunity...");
    await wethToken.approve(tradeExecutor.target, ethToSwap);
    await tradeExecutor.executeTrade(veloRouterAddress, wethToken.target, usdcToken.target, ethToSwap);

    console.log("After swap %s", await wethToken.balanceOf(deployer.address));
    console.log("After swap %s", await usdcToken.balanceOf(deployer.address));
    await arbitrageFinder.establishUniswapPrice(wethToken.target, usdcToken.target);
    uniswapPrice = await arbitrageFinder.getUniswapPrice();
    veloPrice = await arbitrageFinder.getVeloSwapPrice(wethToken.target, usdcToken.target);
    price = +ethers.formatEther(uniswapPrice.toString());
    console.log("Uniswap price after: ", price * ((10 ** 18) / (+mapToDecimals["usdc"])));
    price = +ethers.formatEther(veloPrice.toString());
    console.log("Velo price after: ", price * ((10 ** 18) / (+mapToDecimals["usdc"])));
    const [found, opportunity] = await arbitrageFinder.find(usdcToken.target, wethToken.target, uniswapPrice, veloPrice);

    // Assert the result
    expect(found).to.be.true;
    console.log("2. opportunity: ", opportunity);
    console.log("2 .opportunity: ", opportunity[0]);

    /* Get tokens for arbitrage guy */
    //await tradeExecutor.connect(arbitrageGuy).getWethFromEth(networkConfig[chainId]["weth"], { value: ethToSwap });

    // opportunity[0][4] = ;
    // opportunity[1][4] = wethToken.balanceOf(deployer.address);

    // if (opportunity[0][0] == wethToken.target) {
    //   wethToken.transfer(arbitrageExecutor.address, ethers.parseEther("5"));
    // }
    // else if (opportunity[0][0] == usdcToken.target) {
    //   usdcToken.transfer(arbitrageExecutor.address, 1000 * 10 ** 6);
    // }
    let wethBalance = await wethToken.balanceOf(arbitrageExecutor.target);
    let usdcBalance = await usdcToken.balanceOf(arbitrageExecutor.target);
    console.log("wethBalance: %s\tusdcBalance: %s\n", ethers.formatUnits(wethBalance, 18).toString(), ethers.formatUnits(usdcBalance, 6).toString());
    await arbitrageExecutor.addToWhitelist(arbitrageGuy.address);
    await tradeExecutor.addToWhitelist(arbitrageExecutor.target);
    await arbitrageExecutor.execute(opportunity[0][0], opportunity[0][1], opportunity[0][2], opportunity[1][2]);
    wethBalance = await wethToken.balanceOf(arbitrageExecutor.target);
    usdcBalance = await usdcToken.balanceOf(arbitrageExecutor.target);
    console.log("wethBalance: %s\tusdcBalance: %s\n", ethers.formatUnits(wethBalance, 18).toString(), ethers.formatUnits(usdcBalance, 6).toString());
    // expect(opportunity).to.not.be.undefined;wethBalance
    // You can add more assertions based on your contract's logic
  });


});
