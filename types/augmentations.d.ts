import { Accounts, Signers } from "./";
import { Muralis } from "../typechain";

declare module "mocha" {
  export interface Context {
    accounts: Accounts;
    Muralis: Muralis;
    signers: Signers;
  }
}
