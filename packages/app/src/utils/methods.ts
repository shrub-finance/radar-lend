export function isInvalidOrZero(textInput: string) {
  const isValidInput = /^[0-9]+(\.[0-9]*)?$/.test(textInput);
  if (!isValidInput) {
    return true;
  }
  const parsedValue = parseFloat(textInput);
  return isNaN(parsedValue) || parsedValue === 0;
}

export function truncateAddress(address) {
  if (address) {
    const truncateRegex = /^([a-zA-Z0-9]{4})[a-zA-Z0-9]+([a-zA-Z0-9]{4})$/;
    const match = address.match(truncateRegex);
    if (!match) return address;
    return match[1] + "\u2026" + match[2];
  } else {
    return "-";
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