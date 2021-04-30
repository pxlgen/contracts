import { Signer } from "@ethersproject/abstract-signer";
import { ethers } from "hardhat";
import { solidity, deployContract } from "ethereum-waffle";
import { expect, use } from "chai";

import PxlGenArtifact from "../artifacts/contracts/PxlGen.sol/PxlGen.json";
import PxlGenFactoryArtifact from "../artifacts/contracts/PxlGenFactory.sol/PxlGenFactory.json";
import MockProxyRegistryArtifact from "../artifacts/contracts/test/MockProxyRegistry.sol/MockProxyRegistry.json";
import TestForReentrancyAttackArtifact from "../artifacts/contracts/test/TestForReentrancyAttack.sol/TestForReentrancyAttack.json";
import { Accounts, Signers } from "../types";
import { PxlGen, PxlGenFactory, MockProxyRegistry, TestForReentrancyAttack } from "../typechain";
import { BigNumber } from "ethers";

use(solidity);

const BN_ZERO = ethers.BigNumber.from(0);
const BN_ONE = ethers.BigNumber.from(1);
const ZERO_ADDR = ethers.constants.AddressZero;

describe("PxlGenFactory Unit tests", function () {
  const baseURI = "https://gateway.pinata.cloud/ipfs/";
  const defaultURI = "QmbJbiKnRhfZmTQU6Uh8jHPfVGJ2Uvj4Gu6QiwKJShcnGP";
  before(async function () {
    this.accounts = {} as Accounts;
    this.signers = {} as Signers;
    this.PxlGen = {} as PxlGen;
    this.PxlGenFactory = {} as PxlGenFactory;

    const signers: Signer[] = await ethers.getSigners();

    this.signers.admin = signers[0];
    this.accounts.admin = await signers[0].getAddress();

    this.signers.alice = signers[1];
    this.accounts.alice = await signers[1].getAddress();

    this.signers.bob = signers[2];
    this.accounts.bob = await signers[2].getAddress();

    this.signers.proxy = signers[3];
    this.accounts.proxy = await signers[3].getAddress();

    this.Proxy = (await deployContract(this.signers.admin, MockProxyRegistryArtifact)) as MockProxyRegistry;
    await this.Proxy.setProxy(this.accounts.admin, this.accounts.proxy);

    this.Attacker = (await deployContract(
      this.signers.admin,
      TestForReentrancyAttackArtifact,
    )) as TestForReentrancyAttack;

    this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;

    this.PxlGenFactory = (await deployContract(this.signers.admin, PxlGenFactoryArtifact, [
      this.Proxy.address,
      this.PxlGen.address,
      baseURI + defaultURI,
    ])) as PxlGenFactory;

    await this.PxlGen.setFactory(this.PxlGenFactory.address);
    await this.Attacker.setFactoryAddress(this.PxlGenFactory.address);
  });

  describe("constructor and constants", function () {
    it("should set proxyRegistryAddress to the supplied value", async function () {
      expect(await this.PxlGenFactory.proxyRegistry()).to.eq(this.Proxy.address);
    });
    it("should set pxlGen to the supplied value", async function () {
      expect(await this.PxlGenFactory.pxlGen()).to.eq(this.PxlGen.address);
    });
    it("should set baseMetadataURI to the supplied value", async function () {
      expect(await this.PxlGenFactory.baseMetadataURI()).to.eq(baseURI + defaultURI);
    });
    it("should return the correct name", async function () {
      expect(await this.PxlGenFactory.name()).to.eq("PxlGen Pre-Sale");
    });

    it("should return the correct symbol", async function () {
      expect(await this.PxlGenFactory.symbol()).to.eq("PXL");
    });

    it("should return true", async function () {
      expect(await this.PxlGenFactory.supportsFactoryInterface()).to.eq(true);
    });

    it("should return the schema name", async function () {
      expect(await this.PxlGenFactory.factorySchemaName()).to.eq("ERC1155");
    });

    it("should return the correct number of options", async function () {
      expect(await this.PxlGenFactory.numOptions()).to.eq(400);
    });
  });

  describe("mint", async function () {
    it("should not allow non-owner or non-operator to mint", async function () {
      await expect(
        this.PxlGenFactory.connect(this.signers.alice).mint(1, this.accounts.bob, 1, "0x00"),
      ).to.be.revertedWith("!authorised");
    });

    it("should allow owner to mint", async function () {
      const tokenIndex: number = 1;
      const to = this.accounts.alice;
      const tx = this.PxlGenFactory.mint(tokenIndex, to, 1, "0x00");
      const tokenId: BigNumber = (await this.PxlGen.PLOT_TOKEN_TYPE()).add(tokenIndex);

      await expect(tx).to.emit(this.PxlGen, "PlotMinted").withArgs(to, tokenId, tokenIndex, defaultURI);
      await expect(tx)
        .to.emit(this.PxlGen, "TransferSingle")
        .withArgs(this.PxlGenFactory.address, ethers.constants.AddressZero, to, tokenId, BN_ONE);
      expect(await this.PxlGen.balanceOf(to, tokenId)).to.eq(BN_ONE);
    });

    it("should allow proxy to mint", async function () {
      const tokenIndex: number = 2;
      const to = this.accounts.admin;
      const tx = this.PxlGenFactory.connect(this.signers.proxy).mint(tokenIndex, to, 1, "0x00");
      const tokenId: BigNumber = (await this.PxlGen.PLOT_TOKEN_TYPE()).add(tokenIndex);

      await expect(tx).to.emit(this.PxlGen, "PlotMinted").withArgs(to, tokenId, tokenIndex, defaultURI);
      await expect(tx)
        .to.emit(this.PxlGen, "TransferSingle")
        .withArgs(this.PxlGenFactory.address, ethers.constants.AddressZero, to, tokenId, BN_ONE);
      expect(await this.PxlGen.balanceOf(to, tokenId)).to.eq(BN_ONE);
    });
  });

  describe("canMint", async function () {
    it("should return true for un-minted token", async function () {
      const tokenIndex: number = 3;
      expect(await this.PxlGenFactory.canMint(tokenIndex, 1)).to.equal(true);
    });

    it("should return false for minted token", async function () {
      const tokenIndex: number = 1;
      expect(await this.PxlGenFactory.canMint(tokenIndex, 1)).to.equal(false);
    });
  });

  describe("uri", async function () {
    it("should return the correct uri for an option", async function () {
      const tokenIndex: number = 1;
      expect(await this.PxlGenFactory.uri(tokenIndex)).to.equal(baseURI + defaultURI + "/" + tokenIndex + ".json");
    });
  });

  describe("balanceOf", async function () {
    it("should return max supply for un-minted token", async function () {
      const tokenIndex: number = 3;
      expect(await this.PxlGenFactory.balanceOf(this.accounts.admin, tokenIndex)).to.equal(BN_ONE);
    });

    it("should return balance of minted token", async function () {
      const tokenIndex: number = 1;
      expect(await this.PxlGenFactory.balanceOf(this.accounts.admin, tokenIndex)).to.equal(BN_ZERO);
    });
  });

  describe("safeTransferFrom", async function () {
    it("should work for owner", async function () {
      const tokenIndex: number = 3;
      const tokenId: BigNumber = (await this.PxlGen.PLOT_TOKEN_TYPE()).add(tokenIndex);
      const to = this.accounts.alice;
      await this.PxlGenFactory.safeTransferFrom(ZERO_ADDR, to, tokenIndex, 1, "0x00");
      expect(await this.PxlGen.balanceOf(to, tokenId)).to.eq(BN_ONE);
    });

    it("should work for proxy", async function () {
      const tokenIndex: number = 4;
      const tokenId: BigNumber = (await this.PxlGen.PLOT_TOKEN_TYPE()).add(tokenIndex);
      const to = this.accounts.alice;
      await this.PxlGenFactory.connect(this.signers.proxy).safeTransferFrom(ZERO_ADDR, to, tokenIndex, 1, "0x00");
      expect(await this.PxlGen.balanceOf(to, tokenId)).to.eq(BN_ONE);
    });

    it("should not be callable by non-owner and non-proxy", async function () {
      const tokenIndex: number = 4;
      const to = this.accounts.alice;
      await expect(
        this.PxlGenFactory.connect(this.signers.alice).safeTransferFrom(ZERO_ADDR, to, tokenIndex, 1, "0x00"),
      ).to.be.revertedWith("!authorised");
    });
  });

  describe("isApprovedForAll", () => {
    it("should approve owner as both _owner and _operator", async function () {
      const owner = this.accounts.admin;
      expect(await this.PxlGenFactory.isApprovedForAll(owner, owner)).to.eq(true);
    });

    it("should not approve non-owner as _owner", async function () {
      const owner = this.accounts.admin;
      const alice = this.accounts.alice;
      const bob = this.accounts.bob;
      expect(await this.PxlGenFactory.isApprovedForAll(alice, owner)).to.eq(false);
      expect(await this.PxlGenFactory.isApprovedForAll(bob, alice)).to.eq(false);
    });

    it("should not approve non-proxy address as _operator", async function () {
      const owner = this.accounts.admin;
      const alice = this.accounts.alice;
      expect(await this.PxlGenFactory.isApprovedForAll(owner, alice)).to.eq(false);
    });

    it("should approve proxy address as _operator", async function () {
      const owner = this.accounts.admin;
      const proxy = this.accounts.proxy;
      expect(await this.PxlGenFactory.isApprovedForAll(owner, proxy)).to.eq(true);
    });

    it("should reject proxy as _operator for non-owner _owner", async function () {
      const alice = this.accounts.alice;
      const proxy = this.accounts.proxy;
      expect(await this.PxlGenFactory.isApprovedForAll(alice, proxy)).to.eq(false);
    });
  });
  describe("Re-Entrancy Check", () => {
    it("Should have the correct factory address set", async function () {
      expect(await this.Attacker.factoryAddress()).to.eq(this.PxlGenFactory.address);
    });

    it("Minting from factory should disallow re-entrancy attack", async function () {
      await expect(this.PxlGenFactory.mint(5, this.Attacker.address, 1, "0x00")).to.be.revertedWith(
        "ReentrancyGuard: reentrant call",
      );
    });
  });
});
