import fs from "fs";
import { Signer } from "@ethersproject/abstract-signer";
import { ContractFactory } from "ethers";
import { PxlGen, PxlGenFactory, MockProxyRegistry, Multicall } from "../typechain";
import { TASK_DEPLOY_PXLGEN } from "./task-names";
import { task } from "hardhat/config";
import { DeployedContracts } from "../types";

task(TASK_DEPLOY_PXLGEN, "deploys PxlGen contracts", async function (_taskArgs, { ethers }) {
  console.log("👷🏼‍♂️ Starting deployment\n");
  const DEFAULT_METADATA_URI = "QmaWSDqsKrbSZCGrzRZruUie1MQZkqjUZQor433JRyRh6J";
  const BASE_METADATA_URI = "https://gateway.pinata.cloud/ipfs/";

  console.log("Deploying Proxy...");
  const proxyFactory: ContractFactory = await ethers.getContractFactory("MockProxyRegistry");
  const proxy: MockProxyRegistry = (await proxyFactory.deploy()) as MockProxyRegistry;
  await proxy.deployed();

  const [admin, proxySigner]: Signer[] = await ethers.getSigners();
  console.log("Setting proxy for admin...");
  await proxy.setProxy(await admin.getAddress(), await proxySigner.getAddress());

  console.log("Deploying PxlGen...");
  const pxlgenFactory: ContractFactory = await ethers.getContractFactory("PxlGen");
  const pg: PxlGen = (await pxlgenFactory.deploy(BASE_METADATA_URI, DEFAULT_METADATA_URI)) as PxlGen;
  await pg.deployed();

  console.log("Deploying PxlGenFactory...");
  const pxlgenFactoryFactory: ContractFactory = await ethers.getContractFactory("PxlGenFactory");
  const pgf: PxlGenFactory = (await pxlgenFactoryFactory.deploy(
    proxy.address,
    pg.address,
    "https://gateway.pinata.cloud/ipfs/",
  )) as PxlGenFactory;
  await pgf.deployed();

  console.log("Transfer PxlGen ownershipt to PxlGenFactory...");
  await pg.transferOwnership(pgf.address);

  console.log("Deploying Multicall...");
  const multicallFactory: ContractFactory = await ethers.getContractFactory("Multicall");
  const multicall: Multicall = (await multicallFactory.deploy()) as Multicall;
  await multicall.deployed();

  const deployed: DeployedContracts = {
    PxlGen: pg.address,
    PxlGenFactory: pgf.address,
    Proxy: proxy.address,
    Multicall: multicall.address,
  };

  console.log(
    `
    Deployments:\n
      📄  PxlGen: ${pg.address}
      📄  PxlGenFactory: ${pgf.address}
      📄  Proxy: ${proxy.address}
      📄  Multicall: ${multicall.address}
    `,
  );

  fs.writeFileSync("deployments.json", JSON.stringify(deployed));
});
