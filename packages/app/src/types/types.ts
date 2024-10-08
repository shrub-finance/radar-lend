// import {Chain} from "@thirdweb-dev/chains";


export type PendingStatuses = "pending" | "confirmed" | "failed" | "extending" | "extended" |"withdrawing" | "withdrawn" |"repaying" | "repaid" |"partialRepaying" | "partialRepaid";

export type Borrow = {
  id?: string;
  status?: PendingStatuses;
  collateral?: '';
  // collateral?: ethers.BigNumber;
  created?: number;
  originalPrincipal?: string;
  paid?: string;
  apy?: string;
  principal?: string;
  currentBalanceOverride?: string;
  timestamp?: string;
  startDate?: number;
  updated?: number;
  __typename?: string;
  tempData : boolean;
};

export type BorrowObj = {

}

// export type BorrowObj = {
//     id: ethers.BigNumber| string;
//     startDate: Date;
//     endDate: Date;
//     created: Date;
//     updated: Date;
//     collateral: ethers.BigNumber;
//     principal: ethers.BigNumber
//     originalPrincipal: ethers.BigNumber;
//     paid: ethers.BigNumber;
//     apy: ethers.BigNumber;
//     interest: ethers.BigNumber;
//     debt: ethers.BigNumber;
//     earlyRepaymentFee: ethers.BigNumber;
// }

// export type DepositObj = {
//   id: string;
//   // startDate: Date;
//   endDate: Date;
//   // updated: Date;
//   depositsUsdc: ethers.BigNumber;
//   withdrawsUsdc: ethers.BigNumber;
//   // TODO: This should be coming through from subgraph
//   // apy: ethers.BigNumber;
//   lendingPoolTokenAddress: string;
//   lendingPoolTokenAmount: ethers.BigNumber;
//   positionEthYield: ethers.BigNumber;
//   positionUsdcInterest: ethers.BigNumber;
//   positionPrincipal: ethers.BigNumber;
// }


type LendingPool = {
  id: string;
  timestamp: string;
  tokenSupply: string;
  totalEthYield: string;
  totalPrincipal: string;
  totalUsdcInterest: string;
  finalized?: boolean;
  __typename: string;
};

  export type Deposit = {
    id?: string;
    status?: PendingStatuses;
    depositsUsdc?: string;
    withdrawsUsdc?: string;
    apy?: string;
    currentBalanceOverride?: string;
    interestEarnedOverride?: string;
    lendingPool?: LendingPool;
    timestamp?: number;
    updated?: number;
    amount?: number;
    tempData : boolean;
  };


export type UserFinancialDataState = {
  userData: {
    [address: string]: {
      borrows: Borrow[];
      deposits: Deposit[];
    }
  };
  platformData: {
    activePoolTimestamps: Date[];
  };
};

export type UserFinancialDataAction =
  | { type: "SET_USER_DATA"; payload: { address: string; borrows: Borrow[]; deposits: Deposit[] }; }
  | { type: "CLEAR_USER_DATA" }
  | { type: "ADD_BORROW"; payload: { address: string; borrow: Borrow } }
  | { type: "ADD_LEND_POSITION"; payload: { address: string; deposit: Deposit } }
  | { type: "UPDATE_LEND_POSITION_STATUS"; payload: { address: string; id: string; status: PendingStatuses; } }
  | { type: "UPDATE_BORROW_STATUS"; payload: { address: string; id: string; status: PendingStatuses; } }
  | { type: "SET_ACTIVE_POOLS"; payload: { activePoolTimestamps: Date[]} };

// Extract the `activeChain` type from `ThirdwebSDKProviderProps`
// type ExtractedActiveChainType<TChains extends Chain[]> = ThirdwebSDKProviderProps<TChains>['activeChain'];

// Define the ChainInfo type
// export type ChainInfo<TChains extends Chain[]> = {
//   chainId: number;
//   subgraphUrl: string;
//   rpcUrl: string;
//   thirdwebActiveChain: ExtractedActiveChainType<TChains>;
// };
