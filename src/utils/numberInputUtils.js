export function isNegativeNumberInput(value) {
  if (value === undefined || value === null) return false;
  const text = String(value).trim();
  if (text.length === 0) return false;
  return text.startsWith("-");
}
