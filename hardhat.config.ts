import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
dotenvConfig({ path: resolve(__dirname, "./.env") });

import { HardhatUserConfig } from "hardhat/config";
import { NetworkUserConfig } from "hardhat/types";
import "./tasks/accounts";
import "./tasks/clean";
import "./tasks/generate";
import "./tasks/deploy-pxlgen";
import "./tasks/mint";

import "@nomiclabs/hardhat-waffle";
import "hardhat-typechain";
import "solidity-coverage";
import "hardhat-gas-reporter";

const chainIds = {
  mainnet: 1,
  rinkeby: 4,
  ganache: 1337,
  hardhat: 31337,
};

// Ensure that we have all the environment variables we need.
let mnemonic: string;
if (!process.env.MNEMONIC) {
  throw new Error("Please set your MNEMONIC in a .env file");
} else {
  mnemonic = process.env.MNEMONIC;
}

let ALCHEMY_RINKEBY_API_KEY: string;
if (!process.env.ALCHEMY_RINKEBY_API_KEY) {
  throw new Error("Please set your ALCHEMY_RINKEBY_API_KEY in a .env file");
} else {
  ALCHEMY_RINKEBY_API_KEY = process.env.ALCHEMY_RINKEBY_API_KEY;
}

let ALCHEMY_MAINNET_API_KEY: string;
if (!process.env.ALCHEMY_MAINNET_API_KEY) {
  throw new Error("Please set your ALCHEMY_MAINNET_API_KEY in a .env file");
} else {
  ALCHEMY_MAINNET_API_KEY = process.env.ALCHEMY_MAINNET_API_KEY;
}

function createNetworkConfig(network: keyof typeof chainIds): NetworkUserConfig {
  let url: string;
  if (network == "mainnet") {
    url = ALCHEMY_MAINNET_API_KEY;
  } else {
    url = ALCHEMY_RINKEBY_API_KEY;
  }
  return {
    accounts: {
      count: 10,
      initialIndex: 0,
      mnemonic,
      path: "m/44'/60'/0'/0",
    },
    chainId: chainIds[network],
    url,
  };
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: chainIds.hardhat,
    },
    rinkeby: createNetworkConfig("rinkeby"),
    mainnet: createNetworkConfig("mainnet"),
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.0",
    settings: {
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },
};

export default config;

// ,
//   gasReporter: {
//     currency: "USD",
//     gasPrice: 100,
//   },
