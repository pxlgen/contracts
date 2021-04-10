import { Signer } from "@ethersproject/abstract-signer";
import { task } from "hardhat/config";
// import { HttpNetworkUserConfig } from "hardhat/types";
import { hdkey } from "ethereumjs-wallet";
import * as bip39 from "bip39";
import * as EthUtil from "ethereumjs-util";

import { TASK_ACCOUNTS } from "./task-names";

task(TASK_ACCOUNTS, "Prints the list of accounts")
  .addOptionalParam("debug", "Limit of how much gas to spend")
  .setAction(async (_taskArgs, hre) => {
    const accounts: Signer[] = await hre.ethers.getSigners();
    const DEBUG = _taskArgs.to ? true : true;
    for (const account of accounts) {
      console.log(await account.getAddress());
    }
    const mnemonic = process.env.MNEMONIC ?? "";
    if (DEBUG) console.log("mnemonic", mnemonic);
    // console.log(bip39);
    const seed = await bip39.mnemonicToSeed(mnemonic);
    if (DEBUG) console.log("seed", seed);
    const hdwallet = hdkey.fromMasterSeed(seed);
    const wallet_hdpath = "m/44'/60'/0'/0/";
    const account_index = 0;
    const fullPath = wallet_hdpath + account_index;
    if (DEBUG) console.log("fullPath", fullPath);
    const wallet = hdwallet.derivePath(fullPath).getWallet();
    const privateKey = "0x" + wallet.getPrivateKey().toString("hex");
    if (DEBUG) console.log("privateKey", privateKey);
    const address = "0x" + EthUtil.privateToAddress(wallet.getPrivateKey()).toString("hex");
    console.log("address", address);
    // var qrcode = require("qrcode-terminal");
    // qrcode.generate(address);
    // console.log("‍📬 Deployer Account is " + address);
    // for (let n in hre.config.networks) {
    //   //console.log(config.networks[n],n)
    //   try {
    //     const network = hre.config.networks[n] as HttpNetworkUserConfig;
    //     let provider = new hre.ethers.providers.JsonRpcProvider(network.url);
    //     let balance = await provider.getBalance(address);
    //     console.log(" -- " + n + " --  -- -- 📡 ");
    //     console.log("   balance: " + hre.ethers.utils.formatEther(balance));
    //     console.log("   nonce: " + (await provider.getTransactionCount(address)));
    //   } catch (e) {
    //     if (DEBUG) {
    //       console.log(e);
    //     }
    //   }
    // }
  });

// task("account", "Get balance informations for the deployment account.", async (_, { ethers }) => {});
