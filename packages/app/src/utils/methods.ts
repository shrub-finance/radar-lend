export function isInvalidOrZero(textInput: string) {
  const isValidInput = /^[0-9]+(\.[0-9]*)?$/.test(textInput);
  if (!isValidInput) {
    return true;
  }
  const parsedValue = parseFloat(textInput);
  return isNaN(parsedValue) || parsedValue === 0;
}

export const EXCHANGE_RATE_BUFFER = BigInt(20); // 20 BPS (Basis Points)
export const ONE_HUNDRED_PERCENT = BigInt(10000); // 10000 BPS (100%)

export function truncateAddress(address) {
  if (address) {
    const truncateRegex = /^([a-zA-Z0-9]{4})[a-zA-Z0-9]+([a-zA-Z0-9]{4})$/;
    const match = address.match(truncateRegex);
    if (!match) return address;
    return match[1] + '\u2026' + match[2];
  } else {
    return '-';
  }
}

export function roundSol(value: BigInt, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(Number(value) / factor) / factor;
}

export function percentMul(value: BigInt, percentage: BigInt): BigInt {
  // @ts-ignore
  return (value * percentage) / ONE_HUNDRED_PERCENT;
}

// Apply buffer and calculate final collateral
export function calculateRequiredCollateral(coll: BigInt): number {
  const adjustedPercentage = ONE_HUNDRED_PERCENT + EXCHANGE_RATE_BUFFER;
  const withBuffer = percentMul(coll, adjustedPercentage);
  return roundSol(withBuffer, 6); // Round to 6 decimal places
}

export const interestToLTV = {
  '0': 2000,
  '1': 2500,
  '5': 3300,
  '8': 5000,
};

export const ltvToInterest = {
  '2000': '0',
  '2500': '1',
  '3300': '5',
  '5000': '8',
  '8000': '8',
};
