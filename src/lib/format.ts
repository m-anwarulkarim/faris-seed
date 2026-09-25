const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/** Formats a number with Bangla digits and thousand separators. */
export function bn(value: number): string {
  return value
    .toLocaleString("en-US")
    .replace(/\d/g, (d) => bnDigits[Number(d)] ?? d);
}

/** Sanitize & format BD phone numbers to always start with 01 and be max 11 digits without +88. */
export function formatBDPhone(value: string): string {
  const bnToEn: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  let cleaned = value.replace(/[০-৯]/g, (m) => bnToEn[m] || m);
  cleaned = cleaned.replace(/\D/g, '');

  if (cleaned.startsWith('8801')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('880')) {
    cleaned = '0' + cleaned.substring(3);
  } else if (cleaned.startsWith('88')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('1') && cleaned.length >= 10) {
    cleaned = '0' + cleaned;
  }

  while (cleaned.startsWith('8')) {
    cleaned = cleaned.substring(1);
  }

  return cleaned.slice(0, 11);
}
