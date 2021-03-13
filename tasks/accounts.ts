import { Signer } from "@ethersproject/abstract-signer";
import { task } from "hardhat/config";
import { HttpNetworkUserConfig } from "hardhat/types";

import { TASK_ACCOUNTS } from "./task-names";

task(TASK_ACCOUNTS, "Prints the list of accounts")
  .addOptionalParam("debug", "Limit of how much gas to spend")
  .setAction(async (_taskArgs, hre) => {
    const accounts: Signer[] = await hre.ethers.getSigners();
    const DEBUG = _taskArgs.to ? true : false;
    for (const account of accounts) {
      console.log(await account.getAddress());
    }
    const hdkey = require("ethereumjs-wallet/hdkey");
    const bip39 = require("bip39");
    let mnemonic = process.env.MNEMONIC;
    if (DEBUG) console.log("mnemonic", mnemonic);
    const seed = await bip39.mnemonicToSeed(mnemonic);
    if (DEBUG) console.log("seed", seed);
    const hdwallet = hdkey.fromMasterSeed(seed);
    const wallet_hdpath = "m/44'/60'/0'/0/";
    const account_index = 0;
    let fullPath = wallet_hdpath + account_index;
    if (DEBUG) console.log("fullPath", fullPath);
    const wallet = hdwallet.derivePath(fullPath).getWallet();
    const privateKey = "0x" + wallet._privKey.toString("hex");
    if (DEBUG) console.log("privateKey", privateKey);
    var EthUtil = require("ethereumjs-util");
    const address = "0x" + EthUtil.privateToAddress(wallet._privKey).toString("hex");

    var qrcode = require("qrcode-terminal");
    qrcode.generate(address);
    console.log("‍📬 Deployer Account is " + address);
    for (let n in hre.config.networks) {
      //console.log(config.networks[n],n)
      try {
        const network = hre.config.networks[n] as HttpNetworkUserConfig;
        let provider = new hre.ethers.providers.JsonRpcProvider(network.url);
        let balance = await provider.getBalance(address);
        console.log(" -- " + n + " --  -- -- 📡 ");
        console.log("   balance: " + hre.ethers.utils.formatEther(balance));
        console.log("   nonce: " + (await provider.getTransactionCount(address)));
      } catch (e) {
        if (DEBUG) {
          console.log(e);
        }
      }
    }
  });

task("account", "Get balance informations for the deployment account.", async (_, { ethers }) => {});
