// utils/numberUtils.js
export function isNumericString(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === "number") return true;
  if (typeof val !== "string") return false;
  const s = val.trim();
  if (s === "") return false;
  // Accept digits, optional thousands separators . or , and optional decimals
  // Remove common thousands separators and test
  const cleaned = s.replace(/[.,\s]/g, "");
  return !isNaN(Number(cleaned));
}

export function toNumber(val) {
  if (val === null || val === undefined) return NaN;
  if (typeof val === "number") return val;
  if (typeof val !== "string") return Number(val);
  const cleaned = val.trim().replace(/\./g, "").replace(/,/g, ".");
  // if original used '.' as thousands and ',' as decimals, above tries to normalize.
  // For our case we expect thousands ".", no decimals, so this becomes integer string.
  const n = Number(cleaned);
  return isNaN(n) ? NaN : n;
}

export function formatNumber(val, locale = "id-ID") {
  const n = toNumber(val);
  if (isNaN(n)) return val;
  return n.toLocaleString(locale, { maximumFractionDigits: 0 });
}
