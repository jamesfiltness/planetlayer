/**
 * A number for a legend: up to four significant figures, in the reader's
 * own number format (so 12345.678 is "12,350" in English).
 */
export const formatNumber = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 4 }).format;
