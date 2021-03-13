import { task } from "hardhat/config";
import fs from "fs";
import { TASK_GENERATE } from "./task-names";

task(TASK_GENERATE, "Create a mnemonic for builder deploys", async (_, { ethers }) => {
  const bip39 = require("bip39");
  const hdkey = require("ethereumjs-wallet/hdkey");
  const mnemonic = bip39.generateMnemonic();
  console.log("mnemonic", mnemonic);
  const seed = await bip39.mnemonicToSeed(mnemonic);
  console.log("seed", seed);
  const hdwallet = hdkey.fromMasterSeed(seed);
  const wallet_hdpath = "m/44'/60'/0'/0/";
  const account_index = 0;
  let fullPath = wallet_hdpath + account_index;
  console.log("fullPath", fullPath);
  const wallet = hdwallet.derivePath(fullPath).getWallet();
  const privateKey = "0x" + wallet._privKey.toString("hex");
  console.log("privateKey", privateKey);
  var EthUtil = require("ethereumjs-util");
  const address = "0x" + EthUtil.privateToAddress(wallet._privKey).toString("hex");
  console.log("🔐 Account Generated as " + address + " and set as mnemonic in packages/hardhat");
  console.log("💬 Use 'yarn run account' to get more information about the deployment account.");

  fs.writeFileSync("./" + address + ".txt", mnemonic.toString());
  fs.writeFileSync("./mnemonic.txt", mnemonic.toString());
});
