import { Signer } from "@ethersproject/abstract-signer";
import { ethers } from "hardhat";
import { solidity, deployContract } from "ethereum-waffle";
import { expect, use } from "chai";

import PxlGenArtifact from "../artifacts/contracts/PxlGen.sol/PxlGen.json";
import PrintingPressArtifact from "../artifacts/contracts/PrintingPress.sol/PrintingPress.json";
import { Accounts, Signers } from "../types";
import { PxlGen, PrintingPress } from "../typechain";
import { BigNumber, ContractTransaction } from "ethers";

use(solidity);

const BN_ZERO = ethers.BigNumber.from(0);
const BN_ONE = ethers.BigNumber.from(1);
const ZERO_ADDR = ethers.constants.AddressZero;
const ONE_ETHER = ethers.utils.parseEther("1");

describe("PrintingPress Unit tests", function () {
  const baseURI = "https://gateway.pinata.cloud/ipfs/";
  const defaultURI = "QmbJbiKnRhfZmTQU6Uh8jHPfVGJ2Uvj4Gu6QiwKJShcnGP";
  before(async function () {
    this.accounts = {} as Accounts;
    this.signers = {} as Signers;
    this.PxlGen = {} as PxlGen;
    this.PrintingPress = {} as PrintingPress;

    const signers: Signer[] = await ethers.getSigners();

    this.signers.admin = signers[0];
    this.accounts.admin = await signers[0].getAddress();

    this.signers.alice = signers[1];
    this.accounts.alice = await signers[1].getAddress();

    this.signers.bob = signers[2];
    this.accounts.bob = await signers[2].getAddress();

    this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;

    this.PrintingPress = (await deployContract(this.signers.admin, PrintingPressArtifact, [
      this.PxlGen.address,
    ])) as PrintingPress;

    await this.PxlGen.setPrinter(this.PrintingPress.address);
  });

  describe("mintPrint", function () {
    let tx: ContractTransaction;
    let tokenId: BigNumber;
    before(async function () {
      tokenId = (await this.PxlGen.PRINT_TOKEN_TYPE()).add(1);
      tx = await this.PrintingPress.mintPrint(this.accounts.alice, defaultURI, { value: ONE_ETHER });
    });
    it("reverts when minting to ZERO_ADDR", async function () {
      await expect(this.PrintingPress.mintPrint(ZERO_ADDR, defaultURI, { value: 1 })).to.be.revertedWith(
        "minting to zero address",
      );
    });
    it("reverts when insufficient funds", async function () {
      await expect(this.PrintingPress.mintPrint(this.accounts.alice, defaultURI, { value: 1 })).to.be.revertedWith(
        "Insufficient funds",
      );
    });
    it("emits PrintMint event", async function () {
      const price = await this.PrintingPress.printPrice(1);
      await expect(tx).to.emit(this.PxlGen, "PrintMinted").withArgs(this.accounts.alice, tokenId, 1, defaultURI, price);
    });
    it("curvePool has correct balance", async function () {
      const burnPrice = await this.PrintingPress.burnPrice(1);
      expect(await this.PrintingPress.curvePool()).to.eq(burnPrice);
    });
    it("dividendPool has correct balance", async function () {
      const price = await this.PrintingPress.printPrice(1);
      const burnPrice = await this.PrintingPress.burnPrice(1);
      expect(await this.PrintingPress.dividendPool()).to.eq(price.sub(burnPrice));
    });
    it("sets new tokenUri correctly", async function () {
      expect(await this.PxlGen.uri(tokenId)).to.eq(baseURI + defaultURI);
    });
    it("Should emit TransferSingle event", async function () {
      await expect(tx)
        .to.emit(this.PxlGen, "TransferSingle")
        .withArgs(this.PrintingPress.address, ethers.constants.AddressZero, this.accounts.alice, tokenId, BN_ONE);
    });
    it("Minted to address should have correct balance", async function () {
      expect(await this.PxlGen.balanceOf(this.accounts.alice, tokenId)).to.eq(BN_ONE);
    });
    it("Increments print index", async function () {
      expect(await this.PrintingPress.currentPrintIndex()).to.eq(1);
    });
  });
  describe("burnPrint", function () {
    before(async function () {
      await this.PrintingPress.mintPrint(this.accounts.admin, defaultURI, { value: ONE_ETHER });
    });
    it("reverts when not print token", async function () {
      const tokenId = (await this.PxlGen.PLOT_TOKEN_TYPE()).add(1);
      await this.PxlGen.setFactory(this.accounts.admin);
      await this.PxlGen.mintPlot(this.accounts.admin, 1);
      await expect(this.PrintingPress.burnPrint(tokenId)).to.be.revertedWith("!PRINT_TOKEN_TYPE");
    });
    it("reverts when not owner", async function () {
      const tokenId = (await this.PxlGen.PRINT_TOKEN_TYPE()).add(1);
      await expect(this.PrintingPress.connect(this.signers.bob).burnPrint(tokenId)).to.be.revertedWith("!owner");
    });
    context("After Burn", async function () {
      let tx: ContractTransaction;
      let tokenId: BigNumber;
      let curveBalancePreBurn: BigNumber;
      before(async function () {
        // clean deployment
        this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
        this.PrintingPress = (await deployContract(this.signers.admin, PrintingPressArtifact, [
          this.PxlGen.address,
        ])) as PrintingPress;
        await this.PxlGen.setPrinter(this.PrintingPress.address);

        // mint 2 prints
        await this.PrintingPress.mintPrint(this.accounts.alice, defaultURI, { value: ONE_ETHER });
        await this.PrintingPress.mintPrint(this.accounts.alice, defaultURI, { value: ONE_ETHER });

        curveBalancePreBurn = await this.PrintingPress.curvePool();

        await this.PxlGen.connect(this.signers.alice).setApprovalForAll(this.PrintingPress.address, true);
        tokenId = (await this.PxlGen.PRINT_TOKEN_TYPE()).add(1);
        tx = await this.PrintingPress.connect(this.signers.alice).burnPrint(tokenId);
      });
      it("emits PrintBurned event", async function () {
        const price = await this.PrintingPress.burnPrice(2);
        await expect(tx).to.emit(this.PxlGen, "PrintBurned").withArgs(this.accounts.alice, tokenId, 1, price);
      });
      it("Should emit TransferSingle event", async function () {
        await expect(tx)
          .to.emit(this.PxlGen, "TransferSingle")
          .withArgs(this.PrintingPress.address, this.accounts.alice, ZERO_ADDR, tokenId, BN_ONE);
      });
      it("curvePool has correct balance", async function () {
        const burnPrice = await this.PrintingPress.burnPrice(2);
        expect(await this.PrintingPress.curvePool()).to.eq(curveBalancePreBurn.sub(burnPrice));
      });
      it("has correct print index", async function () {
        expect(await this.PrintingPress.currentPrintIndex()).to.eq(1);
      });
      it("transfers ether to alice", async function () {
        const burnPrice = await this.PrintingPress.burnPrice(2);
        await expect(tx).to.changeEtherBalance(this.signers.alice, burnPrice);
      });
    });
  });
  describe("createDividend", function () {
    it("reverts when minimumPeriod not passed", async function () {
      await expect(this.PrintingPress.createDividend()).to.be.revertedWith("!minimumPeriod");
    });
    context("With created dividends", async function () {
      let tx: ContractTransaction;
      let dividendPool: BigNumber;
      before(async function () {
        await this.PrintingPress.mintPrint(this.accounts.alice, defaultURI, { value: ONE_ETHER });
        await this.PrintingPress.mintPrint(this.accounts.alice, defaultURI, { value: ONE_ETHER });
        await ethers.provider.send("evm_increaseTime", [2678400]); // 30 days
        dividendPool = await this.PrintingPress.dividendPool();
        tx = await this.PrintingPress.createDividend();
      });
      it("emits DividendCreated event", async function () {
        await expect(tx).to.emit(this.PrintingPress, "DividendCreated").withArgs(this.accounts.admin, dividendPool);
      });
      it("resets dividendPool", async function () {
        expect(await this.PrintingPress.dividendPool()).to.equal(BN_ZERO);
      });
      it("dividend pool has correct balance", async function () {
        expect(await this.PrintingPress.dividends(0)).to.equal(dividendPool);
      });
    });
  });
  describe("dividendsToClaim", function () {
    let dividendPool: BigNumber;
    let tokenId: BigNumber;
    before(async function () {
      this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
      this.PrintingPress = (await deployContract(this.signers.admin, PrintingPressArtifact, [
        this.PxlGen.address,
      ])) as PrintingPress;
      await this.PxlGen.setPrinter(this.PrintingPress.address);
      await this.PrintingPress.mintPrint(this.accounts.admin, defaultURI, { value: ONE_ETHER });
      await this.PrintingPress.mintPrint(this.accounts.admin, defaultURI, { value: ONE_ETHER });
      await ethers.provider.send("evm_increaseTime", [2678400]); // 30 days
      dividendPool = await this.PrintingPress.dividendPool();
      tokenId = await (await this.PxlGen.PLOT_TOKEN_TYPE()).add(1);
      await this.PxlGen.setFactory(this.accounts.admin);
      await this.PxlGen.mintPlot(this.accounts.admin, 1);
      await this.PrintingPress.createDividend();
    });
    it("reverts when dividend index outside range", async function () {
      await expect(this.PrintingPress.dividendsToClaim(tokenId, 2)).to.be.revertedWith("No such Dividend");
    });
    it("reverts when wrong token", async function () {
      const wrongtokenId = (await this.PxlGen.PRINT_TOKEN_TYPE()).add(1);
      await expect(this.PrintingPress.dividendsToClaim(wrongtokenId, 2)).to.be.revertedWith("!PLOT_TOKEN_TYPE");
    });
    it("returns correct balance when unclaimed", async function () {
      expect(await this.PrintingPress.dividendsToClaim(tokenId, 0)).to.eq(dividendPool.div(400));
    });
    it("returns correct balance when already claimed", async function () {
      await this.PrintingPress.claimDividend(tokenId, 0);
      expect(await this.PrintingPress.dividendsToClaim(tokenId, 0)).to.eq(0);
    });
  });
  describe("claimDividend", function () {
    let dividendPool: BigNumber;
    let tokenId: BigNumber;
    before(async function () {
      this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
      this.PrintingPress = (await deployContract(this.signers.admin, PrintingPressArtifact, [
        this.PxlGen.address,
      ])) as PrintingPress;
      await this.PxlGen.setPrinter(this.PrintingPress.address);
      await this.PrintingPress.mintPrint(this.accounts.admin, defaultURI, { value: ONE_ETHER });
      await this.PrintingPress.mintPrint(this.accounts.admin, defaultURI, { value: ONE_ETHER });
      await ethers.provider.send("evm_increaseTime", [2678400]); // 30 days
      dividendPool = await this.PrintingPress.dividendPool();
      tokenId = await (await this.PxlGen.PLOT_TOKEN_TYPE()).add(1);
      await this.PxlGen.setFactory(this.accounts.admin);
      await this.PxlGen.mintPlot(this.accounts.admin, 1);
      await this.PrintingPress.createDividend();
    });
    it("reverts when dividend index outside range", async function () {
      await expect(this.PrintingPress.claimDividend(tokenId, 2)).to.be.revertedWith("No such Dividend");
    });
    it("reverts when wrong token", async function () {
      const wrongtokenId = (await this.PxlGen.PRINT_TOKEN_TYPE()).add(1);
      await expect(this.PrintingPress.claimDividend(wrongtokenId, 2)).to.be.revertedWith("!PLOT_TOKEN_TYPE");
    });
    it("reverts when not owner", async function () {
      await expect(this.PrintingPress.connect(this.signers.alice).claimDividend(tokenId, 0)).to.be.revertedWith(
        "!owner",
      );
    });
    context("With dividends claimed", async function () {
      let tx: ContractTransaction;
      before(async function () {
        tx = await this.PrintingPress.claimDividend(tokenId, 0);
      });
      it("emits DividendClaimed event", async function () {
        await tx.wait().then(e => {
          console.log(e);

          if (e) {
            if (e.events) console.log(e.events[0].args);
          }
        });
        await expect(tx).to.emit(this.PrintingPress, "DividendClaimed").withArgs(tokenId, 0, dividendPool.div(400));
      });
      it("has correct dividend balance", async function () {
        expect(await this.PrintingPress.dividendBalance(tokenId)).to.equal(dividendPool.div(400));
      });
      it("reverts when already claimed", async function () {
        await expect(this.PrintingPress.claimDividend(tokenId, 0)).to.be.revertedWith("Already claimed");
      });
    });
  });
  describe("batchClaimDividend", function () {
    const dividendPools: BigNumber[] = [];
    let tokenId: BigNumber;
    before(async function () {
      this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
      this.PrintingPress = (await deployContract(this.signers.admin, PrintingPressArtifact, [
        this.PxlGen.address,
      ])) as PrintingPress;
      await this.PxlGen.setPrinter(this.PrintingPress.address);
      await this.PxlGen.setFactory(this.accounts.admin);
      await this.PxlGen.mintPlot(this.accounts.admin, 1);

      // Dividends 1
      await this.PrintingPress.mintPrint(this.accounts.admin, defaultURI, { value: ONE_ETHER });
      await this.PrintingPress.mintPrint(this.accounts.admin, defaultURI, { value: ONE_ETHER });
      await ethers.provider.send("evm_increaseTime", [2678400]); // 30 days
      dividendPools.push(await (await this.PrintingPress.dividendPool()).div(400));
      await this.PrintingPress.createDividend();

      // Dividends 2
      await this.PrintingPress.mintPrint(this.accounts.admin, defaultURI, { value: ONE_ETHER });
      await this.PrintingPress.mintPrint(this.accounts.admin, defaultURI, { value: ONE_ETHER });
      await ethers.provider.send("evm_increaseTime", [2678400]); // 30 days
      dividendPools.push(await (await this.PrintingPress.dividendPool()).div(400));
      await this.PrintingPress.createDividend();

      // Dividends 3
      await this.PrintingPress.mintPrint(this.accounts.admin, defaultURI, { value: ONE_ETHER });
      await this.PrintingPress.mintPrint(this.accounts.admin, defaultURI, { value: ONE_ETHER });
      await ethers.provider.send("evm_increaseTime", [2678400]); // 30 days
      dividendPools.push(await (await this.PrintingPress.dividendPool()).div(400));
      await this.PrintingPress.createDividend();

      tokenId = await (await this.PxlGen.PLOT_TOKEN_TYPE()).add(1);
    });
    it("reverts when input arrays dont match", async function () {
      await expect(this.PrintingPress.batchClaimDividend([tokenId, tokenId, tokenId], [0, 1])).to.be.revertedWith(
        "tokenIds and idxs length mismatch",
      );
    });
    it("reverts when dividend index outside range", async function () {
      await expect(this.PrintingPress.batchClaimDividend([tokenId, tokenId, tokenId], [100, 0, 1])).to.be.revertedWith(
        "No such Dividend",
      );
    });
    it("reverts when wrong token", async function () {
      const wrongtokenId = (await this.PxlGen.PRINT_TOKEN_TYPE()).add(1);
      await expect(
        this.PrintingPress.batchClaimDividend([wrongtokenId, tokenId, tokenId], [0, 1, 2]),
      ).to.be.revertedWith("!PLOT_TOKEN_TYPE");
    });
    it("reverts when not owner", async function () {
      await expect(
        this.PrintingPress.connect(this.signers.alice).batchClaimDividend([tokenId, tokenId, tokenId], [0, 1, 2]),
      ).to.be.revertedWith("!owner");
    });
    context("With dividends claimed", async function () {
      let tx: ContractTransaction;
      before(async function () {
        tx = await this.PrintingPress.batchClaimDividend([tokenId, tokenId, tokenId], [0, 1, 2]);
      });
      it("emits DividendClaimedBatch event", async function () {
        await expect(tx)
          .to.emit(this.PrintingPress, "DividendClaimedBatch")
          .withArgs([tokenId, tokenId, tokenId], [0, 1, 2], [...dividendPools]);
      });
      it("has correct dividend balance", async function () {
        const bal = dividendPools.reduce((a, b) => a.add(b));
        expect(await this.PrintingPress.dividendBalance(tokenId)).to.equal(bal);
      });
      it("reverts when already claimed", async function () {
        await expect(this.PrintingPress.batchClaimDividend([tokenId, tokenId, tokenId], [0, 1, 2])).to.be.revertedWith(
          "Already claimed",
        );
      });
    });
  });
  describe("hasClaimed", function () {
    it("reverts when dividend index outside range", async function () {
      const tokenId = await (await this.PxlGen.PLOT_TOKEN_TYPE()).add(1);
      await expect(this.PrintingPress.hasClaimed(tokenId, 8)).to.be.revertedWith("No such Dividend");
    });
    context("With dividends claimed", async function () {
      before(async function () {
        await this.PrintingPress.ClaimDividend([tokenId, tokenId, tokenId], [0, 1, 2]);
      });
      it("emits DividendClaimedBatch event", async function () {
        await expect(tx)
          .to.emit(this.PrintingPress, "DividendClaimedBatch")
          .withArgs([tokenId, tokenId, tokenId], [0, 1, 2], [...dividendPools]);
      });
      it("has correct dividend balance", async function () {
        const bal = dividendPools.reduce((a, b) => a.add(b));
        expect(await this.PrintingPress.dividendBalance(tokenId)).to.equal(bal);
      });
      it("reverts when already claimed", async function () {
        await expect(this.PrintingPress.batchClaimDividend([tokenId, tokenId, tokenId], [0, 1, 2])).to.be.revertedWith(
          "Already claimed",
        );
      });
    });
  });
});
