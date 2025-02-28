import { ethers, network } from "hardhat";
import {
  ArbitrageBot,
  ArbitrageExecutor,
  ArbitrageFinder,
  TradeExecutor,
} from "../typechain-types";
import { networkConfig } from "../helper-hardhat-config";

const chainId = network.config.chainId;

export class Contracts {
  bot: ArbitrageBot;
  executor: ArbitrageExecutor;
  finder: ArbitrageFinder;
  tradeExecutor: TradeExecutor;

  constructor(
    bot: ArbitrageBot,
    executor: ArbitrageExecutor,
    finder: ArbitrageFinder,
    tradeExecutor: TradeExecutor
  ) {
    this.bot = bot;
    this.executor = executor;
    this.finder = finder;
    this.tradeExecutor = tradeExecutor;
  }
}

async function main() {
  const [signer] = await ethers.getSigners();
  const provider = ethers.provider;
  const signerBalance = await provider.getBalance(signer.address);

  console.log(
    `starting the deployment script, will deploy multiple contracts to the network: '${network.name}', 
     with owner set to: '${signer.address}', balance: '${signerBalance}'`
  );

  deployContracts();
}

export async function deployContracts(): Promise<Contracts> {
  const tradeExecutor = await deployTradeExecutor();
  const arbitrageExecutor = await deployArbitrageExecutor(
    await tradeExecutor.getAddress()
  );
  const arbitrageFinder = await deployArbitrageFinder();

  const arbitrageBot = await deployArbitrageBot(
    await arbitrageFinder.getAddress(),
    await arbitrageExecutor.getAddress()
  );

  console.log("contracts were deployed, will begin whitelisting dependencies");

  await arbitrageExecutor.addToWhitelist(await arbitrageBot.getAddress());
  await arbitrageFinder.addToWhitelist(await arbitrageBot.getAddress());
  await tradeExecutor.addToWhitelist(await arbitrageExecutor.getAddress());

  return new Contracts(
    arbitrageBot,
    arbitrageExecutor,
    arbitrageFinder,
    tradeExecutor
  );
}

async function deployTradeExecutor(): Promise<TradeExecutor> {
  const contractName = "TradeExecutor";
  console.log(`deploying ${contractName} contract`);

  const contractFactory = await ethers.getContractFactory(contractName);

  var contract = await contractFactory.deploy(
    networkConfig[chainId]["uniswap_router_v3"]!,
    networkConfig[chainId]["velo_router_v2"]!
  );

  contract = await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(
    `contract with name ${contractName} was deployed to address: ${address}`
  );

  return contract;
}

async function deployArbitrageExecutor(
  tradeExecutorAddr: string
): Promise<ArbitrageExecutor> {
  const contractName = "ArbitrageExecutor";
  console.log(`deploying ${contractName} contract`);

  const contractFactory = await ethers.getContractFactory(contractName);

  var contract = await contractFactory.deploy(
    networkConfig[chainId]["aavePoolDataProvider"]!,
    tradeExecutorAddr
  );

  contract = await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(
    `contract with name ${contractName} was deployed to address: ${address}`
  );

  return contract;
}

async function deployArbitrageFinder(): Promise<ArbitrageFinder> {
  const contractName = "ArbitrageFinder";
  console.log(`deploying ${contractName} contract`);

  const contractFactory = await ethers.getContractFactory(contractName);

  var contract = await contractFactory.deploy(
    networkConfig[chainId]["uniswap_router_quoter"]!,
    networkConfig[chainId]["uniswap_router_v3"]!,
    networkConfig[chainId]["velo_router_v2"]!
  );

  contract = await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(
    `contract with name ${contractName} was deployed to address: ${address}`
  );

  return contract;
}

async function deployArbitrageBot(
  arbitrageFinderAddr: string,
  arbitrageExecutorAddr: string
): Promise<ArbitrageBot> {
  const botContractName = "ArbitrageBot";
  console.log(`deploying ${botContractName} contract`);

  const contractFactory = await ethers.getContractFactory(botContractName);

  var contract = await contractFactory.deploy(
    arbitrageFinderAddr,
    arbitrageExecutorAddr
  );

  contract = await contract.waitForDeployment();

  const address = await contract.getAddress();

  console.log(
    `contract with name ${botContractName} was deployed to address: ${address}`
  );

  return contract;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
