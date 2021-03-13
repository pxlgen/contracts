import { ethers } from "hardhat";
import { Signer } from "@ethersproject/abstract-signer";
import { ContractFactory } from "ethers";
import { Muralis } from "../typechain";

async function main(): Promise<void> {
  const muralisFactory: ContractFactory = await ethers.getContractFactory("Muralis");
  const muralis: Muralis = (await muralisFactory.deploy("https://gateway.pinata.cloud/ipfs/")) as Muralis;
  await muralis.deployed();

  console.log("muralis deployed to: ", muralis.address);
  const mint = true;
  if (mint) {
    const [alice, bob, dave]: Signer[] = await ethers.getSigners();
    await muralis.connect(alice).mintCell("QmeBxnHUQ");
    await muralis.connect(bob).mintCell("QmeBxnHUQ");
    await muralis.connect(dave).mintCell("QmeBxnHUQ");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
