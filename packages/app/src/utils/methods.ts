export function isInvalidOrZero(textInput: string) {
  const isValidInput = /^[0-9]+(\.[0-9]*)?$/.test(textInput);
  if (!isValidInput) {
    return true;
  }
  const parsedValue = parseFloat(textInput);
  return isNaN(parsedValue) || parsedValue === 0;
}