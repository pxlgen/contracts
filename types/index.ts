import { Signer } from "@ethersproject/abstract-signer";

export interface Accounts {
  admin: string;
  alice: string;
  bob: string;
  dave: string;
  proxy: string;
}

export interface Signers {
  admin: Signer;
  alice: Signer;
  bob: Signer;
  dave: Signer;
  proxy: Signer;
  list: Signer[];
}

export interface DeployedContracts {
  PxlGen: string;
  PxlGenFactory: string;
  Proxy: string;
  Multicall: string;
}
