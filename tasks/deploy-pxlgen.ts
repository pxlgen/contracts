import fs from "fs";
import { Signer } from "@ethersproject/abstract-signer";
import { ContractFactory } from "ethers";
import { PxlGen, PxlGenFactory, MockProxyRegistry, Multicall } from "../typechain";
import { TASK_DEPLOY_PXLGEN } from "./task-names";
import { task } from "hardhat/config";
import { DeployedContracts } from "../types";

function chainName(chainId: number): string {
  switch (chainId) {
    case 1:
      return "mainnet";
    case 4:
      return "rinkeby";
    case 1337:
      return "ganache";
    case 31337:
      return "hardhat";
    default:
      return "";
  }
}

task(TASK_DEPLOY_PXLGEN, "deploys PxlGen contracts", async function (_taskArgs, { ethers }) {
  const { chainId } = await ethers.provider.getNetwork();
  const networkName = chainName(chainId);

  if (!networkName) {
    console.log("Unsupported network");
  }

  const isLocal = networkName == "ganache" || networkName == "hardhat";
  let proxyAddressForFactory = "";
  let multicallAddress = "";

  console.log(`👷🏼‍♂️ Starting deployment to ${networkName} \n`);

  const DEFAULT_METADATA_URI = "QmaWSDqsKrbSZCGrzRZruUie1MQZkqjUZQor433JRyRh6J";
  const BASE_METADATA_URI = "https://gateway.pinata.cloud/ipfs/";

  if (isLocal) {
    console.log("Deploying Proxy...");
    const proxyFactory: ContractFactory = await ethers.getContractFactory("MockProxyRegistry");
    const proxy: MockProxyRegistry = (await proxyFactory.deploy()) as MockProxyRegistry;
    await proxy.deployed();

    console.log("Setting proxy for admin...");
    const [admin, proxySigner]: Signer[] = await ethers.getSigners();
    await proxy.setProxy(await admin.getAddress(), await proxySigner.getAddress());
    proxyAddressForFactory = proxy.address;

    console.log("Deploying Multicall...");
    const multicallFactory: ContractFactory = await ethers.getContractFactory("Multicall");
    const multicall: Multicall = (await multicallFactory.deploy()) as Multicall;
    await multicall.deployed();
    multicallAddress = multicall.address;
  } else {
    if (networkName === "rinkeby") {
      proxyAddressForFactory = "0xf57b2c51ded3a29e6891aba85459d600256cf317";
    } else {
      proxyAddressForFactory = "0xa5409ec958c83c3f309868babaca7c86dcb077c1";
    }
  }

  console.log("Deploying PxlGen...");
  const pxlgenFactory: ContractFactory = await ethers.getContractFactory("PxlGen");
  const pg: PxlGen = (await pxlgenFactory.deploy(BASE_METADATA_URI, DEFAULT_METADATA_URI)) as PxlGen;
  await pg.deployed();

  console.log("Deploying PxlGenFactory...");
  const pxlgenFactoryFactory: ContractFactory = await ethers.getContractFactory("PxlGenFactory");
  const pgf: PxlGenFactory = (await pxlgenFactoryFactory.deploy(
    proxyAddressForFactory,
    pg.address,
    BASE_METADATA_URI,
  )) as PxlGenFactory;
  await pgf.deployed();

  console.log("Transfer PxlGen ownership to PxlGenFactory...");
  await pg.transferOwnership(pgf.address);

  const deployed: DeployedContracts = {
    PxlGen: pg.address,
    PxlGenFactory: pgf.address,
    Proxy: proxyAddressForFactory,
    Multicall: multicallAddress,
  };

  console.log(
    `
    Deployments:\n
      📄  PxlGen: ${pg.address}
      📄  PxlGenFactory: ${pgf.address}
      📄  Proxy: ${proxyAddressForFactory}
      📄  Multicall: ${multicallAddress}
    `,
  );

  fs.writeFileSync(`deployments/${networkName}.json`, JSON.stringify(deployed));
});
