import {toEthDate, fromEthDate, getPlatformDates} from "@shrub-lend/common"
import { ethers } from 'ethers';
import { Zero } from '../constants';

export const EXCHANGE_RATE_BUFFER = ethers.BigNumber.from(20); // 20 BPS
export const ONE_HUNDRED_PERCENT = ethers.BigNumber.from(10000);  // 10000 BPS

const Ten = ethers.BigNumber.from(10);
const REVERSE_SORTED_VALID_LTV = [
  ethers.BigNumber.from(5000),
  ethers.BigNumber.from(3300),
  ethers.BigNumber.from(2500),
  ethers.BigNumber.from(2000),
  ethers.BigNumber.from(0),
];
const MAX_LTV_FOR_EXTEND = ethers.BigNumber.from(5000);

export {toEthDate, fromEthDate};

export function formatShortDate(date: Date) {
  // Get the user's locale
  const userLocale = navigator.language;

// Use toLocaleDateString to format the date based on the user's locale
  const formattedDate = date.toLocaleDateString(userLocale, {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit'
  });
  return formattedDate;
}

export function truncateEthAddress (address) {
    if(address) {
        const truncateRegex = /^(0x[a-zA-Z0-9]{4})[a-zA-Z0-9]+([a-zA-Z0-9]{4})$/;
        const match = address.match(truncateRegex);
        if (!match)
            return address;
        return match[1] + "\u2026" + match[2];
    }
   else {
       return "-"
    }
}

export const interestToLTV = {
    "0": 2000,
    "1": 2500,
    "5": 3300,
    "8": 5000
}

export const ltvToInterest = {
  '2000': "0",
  '2500': "1",
  '3300': "5",
  '5000': "8",
  '8000': "8"
};

export const timestamps = {
    1: toEthDate(getPlatformDates().oneMonth),
    3: toEthDate(getPlatformDates().threeMonth),
    6: toEthDate(getPlatformDates().sixMonth),
    12: toEthDate(getPlatformDates().twelveMonth)
}

/**
 * @notice converts USDC value in Wad to a string
 * @dev Wad means 18 decimal
 * @dev rounds up for positive numbers and down for negative numbers
 * @param usdcInWad - ethers.BigNumberish : An amount of USDC represented in Wad as a big numberish
 * @return USDC as a formatted string
 */
export function formatLargeUsdc(usdcInWad: ethers.BigNumberish) {
  return formatWad(usdcInWad, 6);
}

/**
 * @notice converts USDC value in Wad to a string
 * @dev Wad means 18 decimal
 * @dev rounds up for positive numbers and down for negative numbers
 * @param wads - ethers.BigNumberish : An amount of Wads represented in Wad as a big numberish
 * @param decimals - number : number of decimals in the returned result
 * @return a formatted string with specified number of decimals
 */
export function formatWad(wads: ethers.BigNumberish, decimals: number) {
  const usdcInWadBN = ethers.BigNumber.from(wads)
  const divisionFactor = ethers.BigNumber.from(10).pow(12)
  const roundAmount = usdcInWadBN.gte(Zero) ?
    ethers.BigNumber.from(5).mul(divisionFactor).div(10) :
    ethers.BigNumber.from(5).mul(divisionFactor).div(10).mul(-1);
  return ethers.utils.formatUnits(usdcInWadBN.add(roundAmount).div(divisionFactor), decimals)
}

/**
 * @notice Converts eth value from a Big Number to a rounded Big Number
 * @dev rounds up for positive numbers and down for negative numbers
 * @param amount - ethers.BigNumberish : An amount of ETH represented in Wad as a big numberish
 * @param decimals - number : number of decimals to round to
 * @return USDC as a formatted string
 */
export function roundEth(amount: ethers.BigNumberish, decimals: number) {
    const amountBN = ethers.BigNumber.from(amount);
    const divisionFactor = ethers.BigNumber.from(10).pow(18 - decimals)
    const roundAmount = amountBN.gt(amountBN.div(divisionFactor).mul(divisionFactor)) ? divisionFactor : Zero
    return amountBN.add(roundAmount).div(divisionFactor).mul(divisionFactor);
}

export function formatPercentage(percentage: ethers.BigNumberish) {
    const percentageBN = ethers.BigNumber.from(percentage);
    return ethers.utils.formatUnits(percentageBN, 2);
}

/**
 * @notice multiply 2 Wads returning a Wad
 * @param a - ethers.BigNumberish : the first number to multiply
 * @param b - ethers.BigNumberish : the second number to multiply
 * @return a * b as a Wad
 */
export function wadMul(a: ethers.BigNumberish, b: ethers.BigNumberish) {
    const aBN = ethers.BigNumber.from(a);
    const bBN = ethers.BigNumber.from(b);
    const scaleFactor = Ten.pow(18);
    return aBN
        .mul(bBN)
        .div(scaleFactor);
}

/**
 * @notice divide 2 Wads by each other returning a Wad
 * @param a - ethers.BigNumberish : the numerator
 * @param b - ethers.BigNumberish : the divisor
 * @return a / b as a Wad
 */
export function wadDiv(a: ethers.BigNumberish, b: ethers.BigNumberish) {
    const aBN = ethers.BigNumber.from(a);
    const bBN = ethers.BigNumber.from(b);
    const scaleFactor = Ten.pow(18);
    return aBN
        .mul(scaleFactor)
        .div(bBN);
}

/**
 * @notice multiply a big number by a percentage returning a big number
 * @param a - ethers.BigNumberish : the number to be multiplied
 * @param percentage - ethers.BigNumberish : the percentage in bps (10000 = 100%)
 * @return a * percentage as BigNumber
 */
export function percentMul(a: ethers.BigNumberish, percentage: ethers.BigNumberish) {
    const aBN = ethers.BigNumber.from(a);
    const percentageBN = ethers.BigNumber.from(percentage);
    const scaleFactor = Ten.pow(4);
    return aBN
        .mul(percentageBN)
        .div(scaleFactor);
}

/**
 * @notice return the duration in years between two dates (Wad)
 * @param startDate - Date : start of duration
 * @param endDate - Date : end of duration
 * @return ethers.BigNumber : the duration expressed in years represented as Wad
 */
export function durationWad(startDate: Date, endDate: Date) {
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationMsBN = ethers.BigNumber.from(durationMs);
    const scaleFactor = Ten.pow(18);
    return durationMsBN
        .mul(scaleFactor)
        .div(1000 * 60 * 60 * 24 * 365)
}

/**
 * @notice return the value of an amount of ETH in USDC
 * @param ethAmount - ethers.BigNumberish : amount of ETH to value in Wad
 * @param ethPrice - ethers.BigNumberish : USDC/ETH expressed with 8 decimals
 * @return ethers.BigNumber : the USDC value of the ETH in Wad
 */
export function ethInUsdc(ethAmount: ethers.BigNumberish, ethPrice: ethers.BigNumberish) {
    const scaleFactor = Ten.pow(10);
    const ethAmountBN = ethers.BigNumber.from(ethAmount);
    // Convert 8 decimal to Wad with scaleFactor
    const ethPriceBN = ethers.BigNumber.from(ethPrice).mul(scaleFactor);
    return wadMul(ethAmountBN, ethPriceBN);
}

/**
 * @notice return the percentage in bps of a ratio of two values
 * @param numerator - ethers.BigNumberish : the numerator (Wad)
 * @param denominator - ethers.BigNumberish : the divisor (Wad)
 * @return ethers.BigNumber : numerator / denominator expressed as a percentage in bps (10000 = 100%)
 */
export function calcPercentage(numerator: ethers.BigNumberish, denominator: ethers.BigNumberish) {
    const numeratorBN = ethers.BigNumber.from(numerator);
    const denominatorBN = ethers.BigNumber.from(denominator);
    const roundAmount = Ten.pow(13).mul(5);
    const scaleFactor = Ten.pow(14); // Convert to bps percentage with 4 decimals
    return (wadDiv(numeratorBN, denominatorBN).add(roundAmount)).div(scaleFactor);
}

/**
 * @notice return the ltv as a percentage in bps
 * @param debt - ethers.BigNumberish : USDC debt (Wad)
 * @param collateral - ethers.BigNumberish : ETH Collateral (Wad)
 * @param ethPrice - ethers.BigNumberish : USDC/ETH expressed as 8 decimals
 * @return ethers.BigNumber : ltv expressed as a percentage in bps (10000 = 100%)
 */
export function calcLtv(debt: ethers.BigNumberish, collateral: ethers.BigNumberish, ethPrice: ethers.BigNumberish) {
  return calcPercentage(debt, ethInUsdc(collateral, ethPrice));
}

/**
 * @notice return the smallest threshold ltv that an ltv corresponds to
 * @param ltv - ethers.BigNumber : ltv expressed as a percentage in bps
 * @param isExtend - boolean : whether the calculation is being made for a borow extension
 * @return ethers.BigNumber : target ltv expressed as a percentage in bps (10000 = 100%)
 */
export function calculateSmallestValidLtv(ltv: ethers.BigNumber, isExtend: boolean) {
  let smallestValid = ethers.constants.Zero; // Initialize to 0 or a suitable default value
  let found = false;

  // Iterate through the array to find the smallest value >= value
  for (let i = 0; i < REVERSE_SORTED_VALID_LTV.length; i++) {
    if (REVERSE_SORTED_VALID_LTV[i].lt(ltv)) {
      continue;
    }
    smallestValid = REVERSE_SORTED_VALID_LTV[i];
    found = true;
  }
  if (!found || !(isExtend && ltv.lte(MAX_LTV_FOR_EXTEND))) {
    throw new Error("Invalid ltv");
  }
  if (found) {
    return smallestValid;
  }
  return MAX_LTV_FOR_EXTEND;
}

/**
 * @notice return required collateral for specified principal and target LTV
 * @param principal - ethers.BigNumber : USDC principal in Wad
 * @param targetLtv - ethers.BigNumber : target ltv expressed as a percentage in bps
 * @param ethPrice - ethers.BigNumber : USDC/ETH expressed as 8 decimals
 * @return ethers.BigNumber : required ETH collateral in Wad
 */
export function requiredCollateral(
  principal: ethers.BigNumber, // 18 Decimals
  targetLtv: ethers.BigNumber, // 4 Decimals
  ethPrice: ethers.BigNumber   // 8 Decimals
) {
  // principal / (targetLtv * ethPrice) - collateral
  const scaleFactor = Ten.pow(6);
  return wadDiv(
    principal,
    ethPrice.mul(targetLtv).mul(scaleFactor)
  );
}

/**
 * @notice return required additional collateral for specified principal, collateral and target LTV
 * @param principal - ethers.BigNumber : USDC principal in Wad
 * @param targetLtv - ethers.BigNumber : target ltv expressed as a percentage in bps
 * @param collateral - ethers.BigNumber : existing ETH collateral for the borrow in Wad
 * @param ethPrice - ethers.BigNumber : USDC/ETH expressed as 8 decimals
 * @return ethers.BigNumber : required ETH collateral in Wad
 */
export function requiredAdditionalCollateral(
  principal: ethers.BigNumber, // 18 Decimals
  targetLtv: ethers.BigNumber, // 4 Decimals
  collateral: ethers.BigNumber, // 18 Decimals
  ethPrice: ethers.BigNumber   // 8 Decimals
) {
  const bufferedEthPrice = percentMul(ethPrice, ONE_HUNDRED_PERCENT.sub(EXCHANGE_RATE_BUFFER));
  const additionalCollateral = requiredCollateral(principal, targetLtv, bufferedEthPrice).sub(collateral)
  if (additionalCollateral.lte(Zero)) {
    return Zero;
  }
  return additionalCollateral;
}

export function isInvalidOrZero(textInput: string) {
  const isValidInput = /^[0-9]+(\.[0-9]*)?$/.test(textInput);
  if (!isValidInput) {
    return true;
  }
  const parsedValue = parseFloat(textInput);
  return isNaN(parsedValue) || parsedValue === 0;
}
