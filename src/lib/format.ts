const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/** Formats a number with Bangla digits and thousand separators. */
export function bn(value: number): string {
  return value
    .toLocaleString("en-US")
    .replace(/\d/g, (d) => bnDigits[Number(d)] ?? d);
}
