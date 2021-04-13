import { Signer } from "@ethersproject/abstract-signer";
import { ethers } from "hardhat";
import { solidity, deployContract } from "ethereum-waffle";
import { expect, use } from "chai";

import PxlGenArtifact from "../artifacts/contracts/PxlGen.sol/PxlGen.json";
import { Accounts, Signers } from "../types";
import { PxlGen } from "../typechain";
import { BigNumber, ContractTransaction } from "ethers";

import { shouldBehaveLikeERC1155 } from "./PxlGen.behaviour";

use(solidity);

const BN_ZERO = ethers.BigNumber.from(0);
const BN_ONE = ethers.BigNumber.from(1);
const ZERO_ADDR = ethers.constants.AddressZero;

describe("PxlGen Unit tests", function () {
  const baseURI = "https://gateway.pinata.cloud/ipfs/";
  const defaultURI = "QmbJbiKnRhfZmTQU6Uh8jHPfVGJ2Uvj4Gu6QiwKJShcnGP";
  before(async function () {
    this.accounts = {} as Accounts;
    this.signers = {} as Signers;
    this.PxlGen = {} as PxlGen;

    const signers: Signer[] = await ethers.getSigners();

    this.signers.admin = signers[0];
    this.accounts.admin = await signers[0].getAddress();

    this.signers.alice = signers[1];
    this.accounts.alice = await signers[1].getAddress();

    this.signers.bob = signers[2];
    this.accounts.bob = await signers[2].getAddress();

    this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
  });

  describe("constructor", function () {
    it("Have correct baseURI", async function () {
      expect(await this.PxlGen.baseURI()).to.eq(baseURI);
    });

    it("Have correct defaultURI", async function () {
      expect(await this.PxlGen.defaultURI()).to.eq(defaultURI);
    });
  });

  describe("constants", function () {
    it("has correct MAX_PLOT_SUPPLY", async function () {
      expect(await this.PxlGen.MAX_PLOT_SUPPLY()).to.eq(400);
    });

    it("Have correct MAX_PRINT_SUPPLY", async function () {
      expect(await this.PxlGen.MAX_PRINT_SUPPLY()).to.eq(800);
    });
  });

  describe("URI", function () {
    it("Should return default uri for token with no tokenURI", async function () {
      const tokenIndex = 100;
      const tokenId = (await this.PxlGen.PLOT_TOKEN_TYPE()).add(tokenIndex);
      expect(await this.PxlGen.uri(tokenId)).to.eq(baseURI + defaultURI + "/" + tokenIndex + ".json");
    });

    it("Should return tokenURI", async function () {
      const tokenIndex = 100;
      const tokenId = (await this.PxlGen.PLOT_TOKEN_TYPE()).add(tokenIndex);
      const tokenURI = "QmYu4zGb5rZx8DWtZoFU3gi5QSRueCTYH8MppiJtBn6qpW";
      const to = this.accounts.admin;
      await this.PxlGen.mintPlot(to, tokenIndex);
      await this.PxlGen.updateTokenURI(tokenId, tokenURI);
      expect(await this.PxlGen.uri(tokenId)).to.eq(baseURI + tokenURI);
    });
  });

  describe("updateTokenURI", function () {
    const tokenIndex: number = 1;
    let tokenId: BigNumber;
    let printTokenId: BigNumber;
    const newURI = "NewURIString";
    before(async function () {
      this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
      tokenId = (await this.PxlGen.PLOT_TOKEN_TYPE()).add(tokenIndex);
      printTokenId = (await this.PxlGen.PRINT_TOKEN_TYPE()).add(tokenIndex);
      const to = this.accounts.admin;
      await this.PxlGen.mintPlot(to, tokenIndex);
    });
    it("only plot tokens can update uri", async function () {
      await expect(this.PxlGen.updateTokenURI(printTokenId, newURI)).to.be.revertedWith("!PLOT_TOKEN_TYPE");
    });
    it("only allow owner to change tokenURI", async function () {
      await expect(this.PxlGen.connect(this.signers.alice).updateTokenURI(tokenId, newURI)).to.be.revertedWith(
        "!owner",
      );
    });
    it("tokenURI should not be empty", async function () {
      await expect(this.PxlGen.updateTokenURI(tokenId, "")).to.be.revertedWith("!valid tokenURI");
    });
    it("sets new tokenUri correctly", async function () {
      const tx = await this.PxlGen.updateTokenURI(tokenId, newURI);
      await expect(tx).to.emit(this.PxlGen, "URI").withArgs(newURI, tokenId);
      expect(await this.PxlGen.uri(tokenId)).to.eq(baseURI + newURI);
    });
  });

  describe("mintPlot", async function () {
    before(async function () {
      this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
    });

    it("cannot mint to zero address", async function () {
      await expect(this.PxlGen.mintPlot(ethers.constants.AddressZero, 1)).to.be.revertedWith(
        "ERC1155: mint to the zero address",
      );
    });

    context("should be valid index", async function () {
      it("Revert when index less than 1", async function () {
        const toAddr = this.accounts.alice;
        await expect(this.PxlGen.mintPlot(toAddr, 0)).to.be.revertedWith("Invalid index");
      });
      it("revert when index greater than 400", async function () {
        const toAddr = this.accounts.alice;
        await expect(this.PxlGen.mintPlot(toAddr, 401)).to.be.revertedWith("Invalid index");
      });
      it("revert if index already minted", async function () {
        const toAddr = this.accounts.alice;
        await this.PxlGen.mintPlot(toAddr, 1);
        await expect(this.PxlGen.mintPlot(toAddr, 1)).to.be.revertedWith("Plot already minted");
      });
    });

    context("only callable by owner", async function () {
      before(async function () {
        this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
      });
      it("succeed when called by owner", async function () {
        const toAddr = this.accounts.alice;
        const token1: BigNumber = (await this.PxlGen.PLOT_TOKEN_TYPE()).add(1);
        await expect(this.PxlGen.mintPlot(toAddr, 1))
          .to.emit(this.PxlGen, "PlotMinted")
          .withArgs(toAddr, token1, 1, defaultURI);
      });

      it("revert if caller is not owner", async function () {
        const toAddr = this.accounts.alice;
        await expect(this.PxlGen.connect(this.signers.alice).mintPlot(toAddr, 1)).to.be.revertedWith(
          "Ownable: caller is not the owner",
        );
      });
    });

    context("minting plot", async function () {
      let tokenIndex: number;
      let tokenId: BigNumber;
      let to: string;
      let mintTx: ContractTransaction;
      before(async function () {
        this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
        tokenIndex = 1;
        tokenId = (await this.PxlGen.PLOT_TOKEN_TYPE()).add(tokenIndex);
        to = this.accounts.admin;
        mintTx = await this.PxlGen.mintPlot(to, tokenIndex);
      });
      it("Should emit PlotMinted event", async function () {
        await expect(mintTx).to.emit(this.PxlGen, "PlotMinted").withArgs(to, tokenId, 1, defaultURI);
      });
      it("Should emit TransferSingle event", async function () {
        await expect(mintTx)
          .to.emit(this.PxlGen, "TransferSingle")
          .withArgs(to, ethers.constants.AddressZero, to, tokenId, BN_ONE);
      });
      it("Minted to address should have correct balance", async function () {
        expect(await this.PxlGen.balanceOf(to, tokenId)).to.eq(BN_ONE);
      });
      it("isIndexMinted should return true", async function () {
        expect(await this.PxlGen.isIndexMinted(tokenIndex)).to.eq(true);
      });
    });
  });
  describe("isPlotToken", function () {
    it("should return true for PLOT_TOKEN_TYPE", async function () {
      const tokenId = (await this.PxlGen.PLOT_TOKEN_TYPE()).add(1);
      expect(await this.PxlGen.isPlotToken(tokenId)).to.eq(true);
    });
    it("should return false for PRINT_TOKEN_TYPE", async function () {
      const tokenId = (await this.PxlGen.PRINT_TOKEN_TYPE()).add(1);
      expect(await this.PxlGen.isPlotToken(tokenId)).to.eq(false);
    });
  });
  describe("getTokenIndex", function () {
    it("should return correct index", async function () {
      const index = 100;
      const tokenId = (await this.PxlGen.PLOT_TOKEN_TYPE()).add(index);
      expect(await this.PxlGen.getTokenIndex(tokenId)).to.eq(index);
    });
  });
  describe("setBaseURI", function () {
    it("Set baseURI", async function () {
      await this.PxlGen.setBaseURI("https://google.com");
      expect(await this.PxlGen.baseURI()).to.eq("https://google.com");
    });
  });
  describe("isIndexMinted", function () {
    before(async function () {
      this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
    });
    it("returns true for minted index", async function () {
      const toAddr = this.accounts.alice;
      await this.PxlGen.mintPlot(toAddr, 1);
      expect(await this.PxlGen.isIndexMinted(1)).to.eq(true);
    });

    it("returns false for non minted index", async function () {
      expect(await this.PxlGen.isIndexMinted(100)).to.eq(false);
    });
  });
  describe("getPlotTokenID", function () {
    before(async function () {
      this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
    });
    it("returns true for minted index", async function () {
      const toAddr = this.accounts.alice;
      await this.PxlGen.mintPlot(toAddr, 1);
      expect(await this.PxlGen.isIndexMinted(1)).to.eq(true);
    });

    it("returns false for non minted index", async function () {
      expect(await this.PxlGen.isIndexMinted(100)).to.eq(false);
    });
  });
  describe("getCoordinates", function () {
    it("reverts with invalid index", async function () {
      await expect(this.PxlGen.getCoordinates(401)).to.be.revertedWith("Invalid index");
    });
    it("returns correct coordinates", async function () {
      let [x, y] = await this.PxlGen.getCoordinates(20);
      expect(x).to.eq(ethers.BigNumber.from(20));
      expect(y).to.eq(ethers.BigNumber.from(1));

      [x, y] = await this.PxlGen.getCoordinates(1);
      expect(x).to.eq(ethers.BigNumber.from(1));
      expect(y).to.eq(ethers.BigNumber.from(1));

      [x, y] = await this.PxlGen.getCoordinates(275);
      expect(x).to.eq(ethers.BigNumber.from(15));
      expect(y).to.eq(ethers.BigNumber.from(14));
    });
  });
  describe("ownerOf", function () {
    let tokenId_1: BigNumber;
    let tokenId_2: BigNumber;
    before(async function () {
      this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
      await this.PxlGen.mintPlot(this.accounts.alice, 1);
      tokenId_1 = (await this.PxlGen.PLOT_TOKEN_TYPE()).add(1);
      tokenId_2 = (await this.PxlGen.PLOT_TOKEN_TYPE()).add(2);
    });
    it("reverts when tokenid doesnt exist", async function () {
      await expect(this.PxlGen.ownerOf(1)).to.be.revertedWith("ERC721: owner query for nonexistent token");
    });
    context("owner gets set correctly", async function () {
      it("when minting", async function () {
        expect(await this.PxlGen.ownerOf(tokenId_1)).to.eq(this.accounts.alice);
      });
      it("when safeTransferFrom", async function () {
        await this.PxlGen.connect(this.signers.alice).safeTransferFrom(
          this.accounts.alice,
          this.accounts.bob,
          tokenId_1,
          1,
          "0x",
        );
        expect(await this.PxlGen.ownerOf(tokenId_1)).to.eq(this.accounts.bob);
      });
      it("when safeBatchTransferFrom", async function () {
        await this.PxlGen.mintPlot(this.accounts.bob, 2);
        await this.PxlGen.connect(this.signers.bob).safeBatchTransferFrom(
          this.accounts.bob,
          this.accounts.alice,
          [tokenId_1, tokenId_2],
          [1, 1],
          "0x",
        );
        expect(await this.PxlGen.ownerOf(tokenId_1)).to.eq(this.accounts.alice);
        expect(await this.PxlGen.ownerOf(tokenId_2)).to.eq(this.accounts.alice);
      });
    });
  });
  shouldBehaveLikeERC1155();
});
