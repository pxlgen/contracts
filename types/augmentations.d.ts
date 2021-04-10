import { Accounts, Signers } from "./";
import { PxlGen, MockProxyRegistry, TestForReentrancyAttack, PxlGenFactory, ERC1155ReceiverMock } from "../typechain";

declare module "mocha" {
  export interface Context {
    accounts: Accounts;
    signers: Signers;
    PxlGen: PxlGen;
    PxlGenFactory: PxlGenFactory;
    Proxy: MockProxyRegistry;
    Attacker: TestForReentrancyAttack;
    ERC1155ReceiverMock: ERC1155ReceiverMock;
  }
}
