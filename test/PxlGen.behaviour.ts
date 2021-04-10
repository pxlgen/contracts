import { Signer } from "@ethersproject/abstract-signer";
import { ethers } from "hardhat";
import { solidity, deployContract } from "ethereum-waffle";
import { expect, use } from "chai";
import PxlGenArtifact from "../artifacts/contracts/PxlGen.sol/PxlGen.json";
import ERC1155ReceiverMockArtifact from "../artifacts/contracts/test/ERC1155ReceiverMock.sol/ERC1155ReceiverMock.json";
import { PxlGen, ERC1155ReceiverMock } from "../typechain";
import { BigNumber, ContractTransaction } from "ethers";

use(solidity);

const BN_ZERO = ethers.BigNumber.from(0);
const BN_ONE = ethers.BigNumber.from(1);
const ZERO_ADDR = ethers.constants.AddressZero;

const RECEIVER_SINGLE_MAGIC_VALUE = "0xf23a6e61";
const RECEIVER_BATCH_MAGIC_VALUE = "0xbc197c81";

export function shouldBehaveLikeERC1155(): void {
  describe("PxlGen like an ERC1155", function () {
    const baseURI = "https://gateway.pinata.cloud/ipfs/";
    const defaultURI = "QmbJbiKnRhfZmTQU6Uh8jHPfVGJ2Uvj4Gu6QiwKJShcnGP";
    let tokenId_1: BigNumber;
    let tokenId_2: BigNumber;
    let tokenId_3: BigNumber;
    before(async function () {
      this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
      tokenId_1 = (await this.PxlGen.CELL_TOKEN_TYPE()).add(1);
      tokenId_2 = (await this.PxlGen.CELL_TOKEN_TYPE()).add(2);
      tokenId_3 = (await this.PxlGen.CELL_TOKEN_TYPE()).add(3);
    });
    describe("balanceOf", function () {
      it("reverts when queried about the zero address", async function () {
        await expect(this.PxlGen.balanceOf(ZERO_ADDR, tokenId_1)).to.be.revertedWith(
          "ERC1155: balance query for the zero address",
        );
      });

      context("when accounts don't own tokens", function () {
        it("returns zero for given addresses", async function () {
          expect(await this.PxlGen.balanceOf(this.accounts.alice, tokenId_1)).to.equal(BN_ZERO);
          expect(await this.PxlGen.balanceOf(this.accounts.bob, tokenId_2)).to.equal(BN_ZERO);
          expect(await this.PxlGen.balanceOf(this.accounts.alice, 0)).to.equal(BN_ZERO);
        });
      });

      context("when accounts own some tokens", function () {
        before(async function () {
          await this.PxlGen.mintCell(this.accounts.admin, 1);
          await this.PxlGen.mintCell(this.accounts.alice, 2);
        });

        it("returns the amount of tokens owned by the given addresses", async function () {
          expect(await this.PxlGen.balanceOf(this.accounts.admin, tokenId_1)).to.equal(BN_ONE);
          expect(await this.PxlGen.balanceOf(this.accounts.alice, tokenId_2)).to.equal(BN_ONE);
          expect(await this.PxlGen.balanceOf(this.accounts.admin, 2)).to.equal(BN_ZERO);
        });
      });
    });
    describe("balanceOfBatch", function () {
      before(async function () {
        this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
      });
      it("reverts when input arrays don't match up", async function () {
        await expect(
          this.PxlGen.balanceOfBatch(
            [this.accounts.admin, this.accounts.alice, this.accounts.admin, this.accounts.alice],
            [tokenId_1, tokenId_2, tokenId_3],
          ),
        ).to.be.revertedWith("ERC1155: accounts and ids length mismatch");

        await expect(
          this.PxlGen.balanceOfBatch([this.accounts.admin, this.accounts.alice], [tokenId_1, tokenId_2, tokenId_3]),
        ).to.be.revertedWith("ERC1155: accounts and ids length mismatch");
      });

      it("reverts when one of the addresses is the zero address", async function () {
        await expect(
          this.PxlGen.balanceOfBatch(
            [this.accounts.admin, this.accounts.alice, ZERO_ADDR],
            [tokenId_1, tokenId_2, tokenId_3],
          ),
        ).to.be.revertedWith("ERC1155: balance query for the zero address");
      });

      context("when accounts don't own tokens", function () {
        it("returns zeros for each account", async function () {
          const result = await this.PxlGen.balanceOfBatch(
            [this.accounts.admin, this.accounts.alice, this.accounts.admin],
            [tokenId_1, tokenId_2, tokenId_3],
          );
          expect(result).to.be.an("array");
          expect(result[0]).to.equal(BN_ZERO);
          expect(result[1]).to.equal(BN_ZERO);
          expect(result[2]).to.equal(BN_ZERO);
        });
      });

      context("when accounts own some tokens", function () {
        before(async function () {
          await this.PxlGen.mintCell(this.accounts.admin, 1);
          await this.PxlGen.mintCell(this.accounts.alice, 2);
        });

        it("returns amounts owned by each account in order passed", async function () {
          const result = await this.PxlGen.balanceOfBatch(
            [this.accounts.alice, this.accounts.admin, this.accounts.admin],
            [tokenId_2, tokenId_1, tokenId_3],
          );
          expect(result).to.be.an("array");
          expect(result[0]).to.equal(BN_ONE);
          expect(result[1]).to.equal(BN_ONE);
          expect(result[2]).to.equal(BN_ZERO);
        });

        it("returns multiple times the balance of the same address when asked", async function () {
          const result = await this.PxlGen.balanceOfBatch(
            [this.accounts.admin, this.accounts.alice, this.accounts.admin],
            [tokenId_1, tokenId_2, tokenId_1],
          );
          expect(result).to.be.an("array");
          expect(result[0]).to.equal(result[2]);
          expect(result[0]).to.equal(BN_ONE);
          expect(result[1]).to.equal(BN_ONE);
          expect(result[2]).to.equal(BN_ONE);
        });
      });
    });

    describe("setApprovalForAll", function () {
      let tx: ContractTransaction;
      let proxyAddr: string;
      beforeEach(async function () {
        proxyAddr = this.accounts.bob;
        tx = await this.PxlGen.connect(this.signers.alice).setApprovalForAll(proxyAddr, true);
      });

      it("sets approval status which can be queried via isApprovedForAll", async function () {
        expect(await this.PxlGen.isApprovedForAll(this.accounts.alice, proxyAddr)).to.be.equal(true);
      });

      it("emits an ApprovalForAll log", async function () {
        // expectEvent.inLogs(logs, "ApprovalForAll", { account: multiTokenHolder, operator: proxy, approved: true });
        await expect(tx).to.emit(this.PxlGen, "ApprovalForAll").withArgs(this.accounts.alice, proxyAddr, true);
      });

      it("can unset approval for an operator", async function () {
        await this.PxlGen.connect(this.signers.alice).setApprovalForAll(proxyAddr, false);
        expect(await this.PxlGen.isApprovedForAll(this.accounts.alice, proxyAddr)).to.be.equal(false);
      });

      it("reverts if attempting to approve self as an operator", async function () {
        await expect(this.PxlGen.setApprovalForAll(this.accounts.admin, true)).to.be.revertedWith(
          "ERC1155: setting approval status for self",
        );
      });
    });

    describe("safeTransferFrom", function () {
      beforeEach(async function () {
        this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
        await this.PxlGen.mintCell(this.accounts.admin, 1);
        await this.PxlGen.mintCell(this.accounts.admin, 2);
      });
      it("reverts when transferring more than balance", async function () {
        await expect(
          this.PxlGen.safeTransferFrom(this.accounts.admin, this.accounts.alice, tokenId_3, 1, "0x00"),
        ).to.be.revertedWith("ERC1155: insufficient balance for transfer");
      });
      it("reverts when transferring to zero address", async function () {
        await expect(
          this.PxlGen.safeTransferFrom(this.accounts.admin, ZERO_ADDR, tokenId_2, 1, "0x00"),
        ).to.be.revertedWith("ERC1155: transfer to the zero address");
      });
      context("when called by the multiTokenHolder", async function () {
        let tx: ContractTransaction;
        beforeEach(async function () {
          tx = await this.PxlGen.safeTransferFrom(this.accounts.admin, this.accounts.alice, tokenId_1, 1, "0x00");
        });
        it("debits transferred balance from sender", async function () {
          const newBalance = await this.PxlGen.balanceOf(this.accounts.admin, tokenId_1);
          expect(newBalance).to.be.equal(BN_ZERO);
        });
        it("credits transferred balance to receiver", async function () {
          const newBalance = await this.PxlGen.balanceOf(this.accounts.alice, tokenId_1);
          expect(newBalance).to.equal(BN_ONE);
        });
        it("emits a TransferSingle log", async function () {
          await expect(tx)
            .to.emit(this.PxlGen, "TransferSingle")
            .withArgs(this.accounts.admin, this.accounts.admin, this.accounts.alice, tokenId_1, BN_ONE);
        });
        it("preserves existing balances which are not transferred by multiTokenHolder", async function () {
          const balance1 = await this.PxlGen.balanceOf(this.accounts.admin, tokenId_2);
          expect(balance1).to.equal(BN_ONE);

          const balance2 = await this.PxlGen.balanceOf(this.accounts.alice, tokenId_2);
          expect(balance2).to.equal(BN_ZERO);
        });
      });
      context("when called by an operator on behalf of the multiTokenHolder", function () {
        let proxyAddr: string;
        let proxySigner: Signer;
        context("when operator is not approved by multiTokenHolder", function () {
          beforeEach(async function () {
            proxyAddr = this.accounts.bob;
            proxySigner = this.signers.bob;
            await this.PxlGen.setApprovalForAll(proxyAddr, false);
          });

          it("reverts", async function () {
            await expect(
              this.PxlGen.connect(proxySigner).safeTransferFrom(
                this.accounts.admin,
                this.accounts.alice,
                tokenId_1,
                1,
                "0x",
              ),
            ).to.be.revertedWith("ERC1155: caller is not owner nor approved");
          });
        });

        context("when operator is approved by multiTokenHolder", function () {
          let tx: ContractTransaction;
          beforeEach(async function () {
            await this.PxlGen.setApprovalForAll(proxyAddr, true);
            tx = await this.PxlGen.connect(proxySigner).safeTransferFrom(
              this.accounts.admin,
              this.accounts.alice,
              tokenId_1,
              1,
              "0x",
            );
          });

          it("debits transferred balance from sender", async function () {
            const newBalance = await this.PxlGen.balanceOf(this.accounts.admin, tokenId_1);
            expect(newBalance).to.be.equal(BN_ZERO);
          });
          it("credits transferred balance to receiver", async function () {
            const newBalance = await this.PxlGen.balanceOf(this.accounts.alice, tokenId_1);
            expect(newBalance).to.equal(BN_ONE);
          });
          it("emits a TransferSingle log", async function () {
            await expect(tx)
              .to.emit(this.PxlGen, "TransferSingle")
              .withArgs(proxyAddr, this.accounts.admin, this.accounts.alice, tokenId_1, BN_ONE);
          });

          it("preserves operator's balances not involved in the transfer", async function () {
            const balance1 = await this.PxlGen.balanceOf(proxyAddr, tokenId_1);
            expect(balance1).to.equal(BN_ZERO);

            const balance2 = await this.PxlGen.balanceOf(proxyAddr, tokenId_2);
            expect(balance2).to.equal(BN_ZERO);
          });
        });
      });
      context("when sending to a valid receiver", function () {
        beforeEach(async function () {
          this.ERC1155ReceiverMock = (await deployContract(this.signers.admin, ERC1155ReceiverMockArtifact, [
            RECEIVER_SINGLE_MAGIC_VALUE,
            false,
            RECEIVER_BATCH_MAGIC_VALUE,
            false,
          ])) as ERC1155ReceiverMock;
        });

        context("without data", function () {
          let tx: ContractTransaction;
          beforeEach(async function () {
            this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
            await this.PxlGen.mintCell(this.accounts.admin, 1);
            tx = await this.PxlGen.safeTransferFrom(
              this.accounts.admin,
              this.ERC1155ReceiverMock.address,
              tokenId_1,
              1,
              "0x",
            );
          });

          it("debits transferred balance from sender", async function () {
            const newBalance = await this.PxlGen.balanceOf(this.accounts.admin, tokenId_1);
            expect(newBalance).to.be.equal(BN_ZERO);
          });
          it("credits transferred balance to receiver", async function () {
            const newBalance = await this.PxlGen.balanceOf(this.ERC1155ReceiverMock.address, tokenId_1);
            expect(newBalance).to.equal(BN_ONE);
          });
          it("emits a TransferSingle log", async function () {
            await expect(tx)
              .to.emit(this.PxlGen, "TransferSingle")
              .withArgs(this.accounts.admin, this.accounts.admin, this.ERC1155ReceiverMock.address, tokenId_1, BN_ONE);
          });

          it("calls onERC1155Received", async function () {
            await expect(tx)
              .to.emit(this.ERC1155ReceiverMock, "Received")
              .withArgs(this.accounts.admin, this.accounts.admin, tokenId_1, BN_ONE, "0x");
          });
        });

        context("with data", function () {
          const data = "0xf00dd00d";
          let tx: ContractTransaction;
          beforeEach(async function () {
            this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
            await this.PxlGen.mintCell(this.accounts.admin, 1);
            tx = await this.PxlGen.safeTransferFrom(
              this.accounts.admin,
              this.ERC1155ReceiverMock.address,
              tokenId_1,
              1,
              data,
            );
          });

          it("debits transferred balance from sender", async function () {
            const newBalance = await this.PxlGen.balanceOf(this.accounts.admin, tokenId_1);
            expect(newBalance).to.be.equal(BN_ZERO);
          });
          it("credits transferred balance to receiver", async function () {
            const newBalance = await this.PxlGen.balanceOf(this.ERC1155ReceiverMock.address, tokenId_1);
            expect(newBalance).to.equal(BN_ONE);
          });
          it("emits a TransferSingle log", async function () {
            await expect(tx)
              .to.emit(this.PxlGen, "TransferSingle")
              .withArgs(this.accounts.admin, this.accounts.admin, this.ERC1155ReceiverMock.address, tokenId_1, BN_ONE);
          });

          it("calls onERC1155Received", async function () {
            await expect(tx)
              .to.emit(this.ERC1155ReceiverMock, "Received")
              .withArgs(this.accounts.admin, this.accounts.admin, tokenId_1, BN_ONE, data);
          });
        });
      });

      context("to a receiver contract returning unexpected value", function () {
        beforeEach(async function () {
          this.ERC1155ReceiverMock = (await deployContract(this.signers.admin, ERC1155ReceiverMockArtifact, [
            "0x00c0ffee",
            false,
            RECEIVER_BATCH_MAGIC_VALUE,
            false,
          ])) as ERC1155ReceiverMock;
          this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
          await this.PxlGen.mintCell(this.accounts.admin, 1);
        });

        it("reverts", async function () {
          await expect(
            this.PxlGen.safeTransferFrom(this.accounts.admin, this.ERC1155ReceiverMock.address, tokenId_1, 1, "0x"),
          ).to.be.revertedWith("ERC1155: ERC1155Receiver rejected tokens");
        });
      });

      context("to a receiver contract that reverts", function () {
        beforeEach(async function () {
          this.ERC1155ReceiverMock = (await deployContract(this.signers.admin, ERC1155ReceiverMockArtifact, [
            RECEIVER_SINGLE_MAGIC_VALUE,
            true,
            RECEIVER_BATCH_MAGIC_VALUE,
            false,
          ])) as ERC1155ReceiverMock;
        });

        it("reverts", async function () {
          await expect(
            this.PxlGen.safeTransferFrom(this.accounts.admin, this.ERC1155ReceiverMock.address, tokenId_1, 1, "0x"),
          ).to.be.revertedWith("ERC1155ReceiverMock: reverting on receive");
        });
      });

      context("to a contract that does not implement the required function", function () {
        before(async function () {
          this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
          await this.PxlGen.mintCell(this.accounts.admin, 1);
        });
        it("reverts", async function () {
          const invalidReceiver = this.PxlGen;
          await expect(
            this.PxlGen.safeTransferFrom(this.accounts.admin, invalidReceiver.address, tokenId_1, 1, "0x"),
          ).to.be.reverted;
        });
      });
    });
    describe("safeBatchTransferFrom", function () {
      beforeEach(async function () {
        this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
        await this.PxlGen.mintCell(this.accounts.admin, 1);
        await this.PxlGen.mintCell(this.accounts.admin, 2);
      });

      it("reverts when transferring amount more than any of balances", async function () {
        await expect(
          this.PxlGen.safeBatchTransferFrom(
            this.accounts.admin,
            this.accounts.alice,
            [tokenId_1, tokenId_2],
            [1, 2],
            "0x00",
          ),
        ).to.be.revertedWith("ERC1155: insufficient balance for transfer");
      });

      it("reverts when ids array length doesn't match amounts array length", async function () {
        await expect(
          this.PxlGen.safeBatchTransferFrom(this.accounts.admin, this.accounts.alice, [tokenId_1], [1, 2], "0x00"),
        ).to.be.revertedWith("ERC1155: ids and amounts length mismatch");

        await expect(
          this.PxlGen.safeBatchTransferFrom(
            this.accounts.admin,
            this.accounts.alice,
            [tokenId_1, tokenId_2],
            [1],
            "0x00",
          ),
        ).to.be.revertedWith("ERC1155: ids and amounts length mismatch");
      });

      it("reverts when transferring to zero address", async function () {
        await expect(
          this.PxlGen.safeBatchTransferFrom(this.accounts.admin, ZERO_ADDR, [tokenId_1, tokenId_2], [1, 1], "0x00"),
        ).to.be.revertedWith("ERC1155: transfer to the zero address");
      });

      context("when called by the multiTokenHolder", async function () {
        let tx: ContractTransaction;
        beforeEach(async function () {
          this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
          await this.PxlGen.mintCell(this.accounts.admin, 1);
          await this.PxlGen.mintCell(this.accounts.admin, 2);
          tx = await this.PxlGen.safeBatchTransferFrom(
            this.accounts.admin,
            this.accounts.alice,
            [tokenId_1, tokenId_2],
            [1, 1],
            "0x",
          );
        });

        it("debits transferred balances from sender", async function () {
          const newBalances = await this.PxlGen.balanceOfBatch(
            [this.accounts.admin, this.accounts.admin],
            [tokenId_1, tokenId_2],
          );
          for (const newBalance of newBalances) {
            expect(newBalance).to.equal(BN_ZERO);
          }
        });

        it("credits transferred balances to receiver", async function () {
          const newBalances = await this.PxlGen.balanceOfBatch(
            [this.accounts.alice, this.accounts.alice],
            [tokenId_1, tokenId_2],
          );
          for (let i = 0; i < newBalances.length; i++) {
            expect(newBalances[i]).to.equal(1);
          }
        });

        it("emits a TransferBatch log", async function () {
          await expect(tx)
            .to.emit(this.PxlGen, "TransferBatch")
            .withArgs(this.accounts.admin, this.accounts.admin, this.accounts.alice, [tokenId_1, tokenId_2], [1, 1]);
        });
      });

      context("when called by an operator on behalf of the multiTokenHolder", function () {
        let proxyAddr: string;
        let proxySigner: Signer;
        context("when operator is not approved by multiTokenHolder", function () {
          beforeEach(async function () {
            proxyAddr = this.accounts.bob;
            proxySigner = this.signers.bob;
            await this.PxlGen.setApprovalForAll(proxyAddr, false);
          });

          it("reverts", async function () {
            await expect(
              this.PxlGen.connect(proxySigner).safeBatchTransferFrom(
                this.accounts.admin,
                this.accounts.alice,
                [tokenId_1, tokenId_2],
                [1, 1],
                "0x",
              ),
            ).to.be.revertedWith("ERC1155: transfer caller is not owner nor approved");
          });
        });

        context("when operator is approved by multiTokenHolder", function () {
          let tx: ContractTransaction;
          beforeEach(async function () {
            await this.PxlGen.setApprovalForAll(proxyAddr, true);
            tx = await this.PxlGen.connect(proxySigner).safeBatchTransferFrom(
              this.accounts.admin,
              this.accounts.alice,
              [tokenId_1, tokenId_2],
              [1, 1],
              "0x",
            );
          });

          it("debits transferred balances from sender", async function () {
            const newBalances = await this.PxlGen.balanceOfBatch(
              [this.accounts.admin, this.accounts.admin],
              [tokenId_1, tokenId_2],
            );
            for (const newBalance of newBalances) {
              expect(newBalance).to.equal(BN_ZERO);
            }
          });

          it("credits transferred balances to receiver", async function () {
            const newBalances = await this.PxlGen.balanceOfBatch(
              [this.accounts.alice, this.accounts.alice],
              [tokenId_1, tokenId_2],
            );
            for (let i = 0; i < newBalances.length; i++) {
              expect(newBalances[i]).to.equal(1);
            }
          });

          it("emits a TransferBatch log", async function () {
            await expect(tx)
              .to.emit(this.PxlGen, "TransferBatch")
              .withArgs(proxyAddr, this.accounts.admin, this.accounts.alice, [tokenId_1, tokenId_2], [1, 1]);
          });

          it("preserves operator's balances not involved in the transfer", async function () {
            const balance1 = await this.PxlGen.balanceOf(proxyAddr, tokenId_1);
            expect(balance1).to.equal(BN_ZERO);

            const balance2 = await this.PxlGen.balanceOf(proxyAddr, tokenId_2);
            expect(balance2).to.equal(BN_ZERO);
          });
        });
      });

      context("when sending to a valid receiver", function () {
        beforeEach(async function () {
          this.ERC1155ReceiverMock = (await deployContract(this.signers.admin, ERC1155ReceiverMockArtifact, [
            RECEIVER_SINGLE_MAGIC_VALUE,
            false,
            RECEIVER_BATCH_MAGIC_VALUE,
            false,
          ])) as ERC1155ReceiverMock;
        });

        context("without data", function () {
          let txReceive: ContractTransaction;
          beforeEach(async function () {
            this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
            await this.PxlGen.mintCell(this.accounts.admin, 1);
            await this.PxlGen.mintCell(this.accounts.admin, 2);
            txReceive = await this.PxlGen.safeBatchTransferFrom(
              this.accounts.admin,
              this.ERC1155ReceiverMock.address,
              [tokenId_1, tokenId_2],
              [1, 1],
              "0x",
            );
          });

          it("debits transferred balances from sender", async function () {
            const newBalances = await this.PxlGen.balanceOfBatch(
              [this.accounts.admin, this.accounts.admin],
              [tokenId_1, tokenId_2],
            );
            for (const newBalance of newBalances) {
              expect(newBalance).to.equal(BN_ZERO);
            }
          });

          it("credits transferred balances to receiver", async function () {
            const newBalances = await this.PxlGen.balanceOfBatch(
              [this.ERC1155ReceiverMock.address, this.ERC1155ReceiverMock.address],
              [tokenId_1, tokenId_2],
            );
            for (let i = 0; i < newBalances.length; i++) {
              expect(newBalances[i]).to.equal(1);
            }
          });

          it("emits a TransferBatch log", async function () {
            await expect(txReceive)
              .to.emit(this.PxlGen, "TransferBatch")
              .withArgs(
                this.accounts.admin,
                this.accounts.admin,
                this.ERC1155ReceiverMock.address,
                [tokenId_1, tokenId_2],
                [1, 1],
              );
          });

          it("calls onERC1155BatchReceived", async function () {
            await expect(txReceive)
              .to.emit(this.ERC1155ReceiverMock, "BatchReceived")
              .withArgs(this.accounts.admin, this.accounts.admin, [tokenId_1, tokenId_2], [BN_ONE, BN_ONE], "0x");
          });
        });

        context("with data", function () {
          const data = "0xf00dd00d";
          let txReceive: ContractTransaction;
          beforeEach(async function () {
            this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
            await this.PxlGen.mintCell(this.accounts.admin, 1);
            await this.PxlGen.mintCell(this.accounts.admin, 2);
            txReceive = await this.PxlGen.safeBatchTransferFrom(
              this.accounts.admin,
              this.ERC1155ReceiverMock.address,
              [tokenId_1, tokenId_2],
              [1, 1],
              data,
            );
          });

          it("debits transferred balances from sender", async function () {
            const newBalances = await this.PxlGen.balanceOfBatch(
              [this.accounts.admin, this.accounts.admin],
              [tokenId_1, tokenId_2],
            );
            for (const newBalance of newBalances) {
              expect(newBalance).to.equal(BN_ZERO);
            }
          });

          it("credits transferred balances to receiver", async function () {
            const newBalances = await this.PxlGen.balanceOfBatch(
              [this.ERC1155ReceiverMock.address, this.ERC1155ReceiverMock.address],
              [tokenId_1, tokenId_2],
            );
            for (let i = 0; i < newBalances.length; i++) {
              expect(newBalances[i]).to.equal(1);
            }
          });

          it("emits a TransferBatch log", async function () {
            await expect(txReceive)
              .to.emit(this.PxlGen, "TransferBatch")
              .withArgs(
                this.accounts.admin,
                this.accounts.admin,
                this.ERC1155ReceiverMock.address,
                [tokenId_1, tokenId_2],
                [1, 1],
              );
          });

          it("calls onERC1155BatchReceived", async function () {
            await expect(txReceive)
              .to.emit(this.ERC1155ReceiverMock, "BatchReceived")
              .withArgs(this.accounts.admin, this.accounts.admin, [tokenId_1, tokenId_2], [BN_ONE, BN_ONE], data);
          });
        });
      });
    });

    context("to a receiver contract returning unexpected value", function () {
      beforeEach(async function () {
        this.ERC1155ReceiverMock = (await deployContract(this.signers.admin, ERC1155ReceiverMockArtifact, [
          RECEIVER_SINGLE_MAGIC_VALUE,
          false,
          RECEIVER_SINGLE_MAGIC_VALUE,
          false,
        ])) as ERC1155ReceiverMock;
        this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;

        await this.PxlGen.mintCell(this.accounts.admin, 1);
        await this.PxlGen.mintCell(this.accounts.admin, 2);
      });

      it("reverts", async function () {
        await expect(
          this.PxlGen.safeBatchTransferFrom(
            this.accounts.admin,
            this.ERC1155ReceiverMock.address,
            [tokenId_1, tokenId_2],
            [1, 1],
            "0x",
          ),
        ).to.be.revertedWith("ERC1155: ERC1155Receiver rejected tokens");
      });
    });

    context("to a receiver contract that reverts", function () {
      beforeEach(async function () {
        this.ERC1155ReceiverMock = (await deployContract(this.signers.admin, ERC1155ReceiverMockArtifact, [
          RECEIVER_SINGLE_MAGIC_VALUE,
          false,
          RECEIVER_BATCH_MAGIC_VALUE,
          true,
        ])) as ERC1155ReceiverMock;
        this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
        await this.PxlGen.mintCell(this.accounts.admin, 1);
        await this.PxlGen.mintCell(this.accounts.admin, 2);
      });

      it("reverts", async function () {
        await expect(
          this.PxlGen.safeBatchTransferFrom(
            this.accounts.admin,
            this.ERC1155ReceiverMock.address,
            [tokenId_1, tokenId_2],
            [1, 1],
            "0x",
          ),
        ).to.be.revertedWith("ERC1155ReceiverMock: reverting on batch receive");
      });
    });

    context("to a receiver contract that reverts only on single transfers", function () {
      let txReceive: ContractTransaction;

      beforeEach(async function () {
        this.ERC1155ReceiverMock = (await deployContract(this.signers.admin, ERC1155ReceiverMockArtifact, [
          RECEIVER_SINGLE_MAGIC_VALUE,
          true,
          RECEIVER_BATCH_MAGIC_VALUE,
          false,
        ])) as ERC1155ReceiverMock;
        this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
        await this.PxlGen.mintCell(this.accounts.admin, 1);
        await this.PxlGen.mintCell(this.accounts.admin, 2);
        txReceive = await this.PxlGen.safeBatchTransferFrom(
          this.accounts.admin,
          this.ERC1155ReceiverMock.address,
          [tokenId_1, tokenId_2],
          [1, 1],
          "0x",
        );
      });

      it("debits transferred balances from sender", async function () {
        const newBalances = await this.PxlGen.balanceOfBatch(
          [this.accounts.admin, this.accounts.admin],
          [tokenId_1, tokenId_2],
        );
        for (const newBalance of newBalances) {
          expect(newBalance).to.equal(BN_ZERO);
        }
      });

      it("credits transferred balances to receiver", async function () {
        const newBalances = await this.PxlGen.balanceOfBatch(
          [this.ERC1155ReceiverMock.address, this.ERC1155ReceiverMock.address],
          [tokenId_1, tokenId_2],
        );
        for (let i = 0; i < newBalances.length; i++) {
          expect(newBalances[i]).to.equal(1);
        }
      });

      it("emits a TransferBatch log", async function () {
        await expect(txReceive)
          .to.emit(this.PxlGen, "TransferBatch")
          .withArgs(
            this.accounts.admin,
            this.accounts.admin,
            this.ERC1155ReceiverMock.address,
            [tokenId_1, tokenId_2],
            [1, 1],
          );
      });

      it("calls onERC1155BatchReceived", async function () {
        await expect(txReceive)
          .to.emit(this.ERC1155ReceiverMock, "BatchReceived")
          .withArgs(this.accounts.admin, this.accounts.admin, [tokenId_1, tokenId_2], [BN_ONE, BN_ONE], "0x");
      });
    });

    context("to a contract that does not implement the required function", function () {
      before(async function () {
        this.PxlGen = (await deployContract(this.signers.admin, PxlGenArtifact, [baseURI, defaultURI])) as PxlGen;
        await this.PxlGen.mintCell(this.accounts.admin, 1);
        await this.PxlGen.mintCell(this.accounts.admin, 2);
      });
      it("reverts", async function () {
        const invalidReceiver = this.PxlGen;
        await expect(
          this.PxlGen.safeBatchTransferFrom(
            this.accounts.admin,
            invalidReceiver.address,
            [tokenId_1, tokenId_2],
            [1, 1],
            "0x",
          ),
        ).to.be.reverted;
      });
    });
  });
}
