import { Signer } from "@ethersproject/abstract-signer";
import { ethers } from "hardhat";
import { solidity, deployContract } from "ethereum-waffle";
import { expect, use } from "chai";

import MuralisArtifact from "../artifacts/contracts/Muralis.sol/Muralis.json";
import { Accounts, Signers } from "../types";
import { Muralis } from "../typechain";
import { BigNumber } from "ethers";

use(solidity);

describe("Unit tests", function () {
  before(async function () {
    this.accounts = {} as Accounts;
    this.signers = {} as Signers;
    this.Muralis = {} as Muralis;

    const signers: Signer[] = await ethers.getSigners();

    this.signers.admin = signers[0];
    this.accounts.admin = await signers[0].getAddress();

    this.signers.alice = signers[1];
    this.accounts.alice = await signers[1].getAddress();

    this.signers.bob = signers[2];
    this.accounts.bob = await signers[2].getAddress();
  });

  describe("Muralis", function () {
    const baseURI = "https://gateway.pinata.cloud/ipfs/";
    // const sendTx = async function (to: string, s: Signer, v: string) {
    //   return await s.sendTransaction({
    //     to: to,
    //     value: ethers.utils.parseEther(v),
    //     gasLimit: 400000,
    //   });
    // };

    beforeEach(async function () {
      this.Muralis = (await deployContract(this.signers.admin, MuralisArtifact, [baseURI])) as Muralis;
    });

    it("Have correct baseURI", async function () {
      expect(await this.Muralis.baseURI()).to.eq("https://gateway.pinata.cloud/ipfs/");
    });

    it("Set baseURI", async function () {
      await this.Muralis.setBaseURI("https://google.com");
      expect(await this.Muralis.baseURI()).to.eq("https://google.com");
    });

    it("Should mint cell", async function () {
      const CELL_TOKEN_TYPE: BigNumber = await this.Muralis.CELL_TOKEN_TYPE();
      const tokenIndex: number = 1;
      const tokenId = CELL_TOKEN_TYPE.add(tokenIndex);
      const tokenURI = "QmeBxnHUQ";
      const mint = await this.Muralis.connect(this.signers.alice).mintCell(tokenURI);

      await expect(mint).to.emit(this.Muralis, "CellMinted").withArgs(this.accounts.alice, tokenId, 1, "QmeBxnHUQ");

      await expect(mint)
        .to.emit(this.Muralis, "TransferSingle")
        .withArgs(
          this.accounts.alice,
          ethers.constants.AddressZero,
          this.accounts.alice,
          tokenId,
          ethers.BigNumber.from(1),
        );
      expect(await this.Muralis.balanceOf(this.accounts.alice, tokenId)).to.eq(ethers.BigNumber.from(1));
      expect(await this.Muralis.uri(tokenId)).to.eq(baseURI + tokenURI);
    });
  });
});
