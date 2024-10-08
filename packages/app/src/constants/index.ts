

// export const {oneMonth, threeMonth, sixMonth, twelveMonth} = getPlatformDates();

export const interestRates = [
  { id: "smallest-borrow", rate: "0" },
  { id: "small-borrow", rate: "1" },
  { id: "big-borrow", rate: "5" },
  { id: "biggest-borrow", rate: "8" },
];

// export const Zero = ethers.constants.Zero;

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

// TODO: These should come from subgraph GlobalData - they are specified in the contract PlatformConfig
export const EARLY_REPAYMENT_THRESHOLD = 30 * DAY; // 30 Days
export const LENDING_POOL_UNLOCK_BUFFER = 6 * HOUR; // 6 Hours
// export const EARLY_REPAYMENT_APY = ethers.BigNumber.from("500");
