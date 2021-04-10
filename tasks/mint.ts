import fs from "fs";
import { Signer } from "@ethersproject/abstract-signer";
import { PxlGenFactory } from "../typechain";
import PxlGenFactoryArtifact from "../artifacts/contracts/PxlGenFactory.sol/PxlGenFactory.json";
import { TASK_MINT } from "./task-names";
import { task } from "hardhat/config";
import { DeployedContracts } from "../types";
import { types } from "hardhat/config";

task(TASK_MINT, "deploys PxlGen contracts")
  .addParam("from", "starting index", 1, types.int)
  .addParam("to", "ending index", 50, types.int)
  .setAction(async function (taskArgs, { ethers }) {
    console.log(`Minting tokens ${taskArgs.from}-${taskArgs.to}`);

    const admin: Signer = (await ethers.getSigners())[0];
    const rawdata = fs.readFileSync("deployments.json");
    const deployments: DeployedContracts = JSON.parse(rawdata.toString());

    const pgf: PxlGenFactory = new ethers.Contract(
      deployments.PxlGenFactory,
      PxlGenFactoryArtifact.abi,
      admin,
    ) as PxlGenFactory;

    const adminAddr = await admin.getAddress();
    console.log(`Minting tokens to: ${adminAddr}`);

    for (let i = taskArgs.from; i <= taskArgs.to; i++) {
      await pgf.mint(i, adminAddr, 1, "0x", { gasLimit: 2000000 });
    }
  });
