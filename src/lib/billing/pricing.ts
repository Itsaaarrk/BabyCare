import { FALLBACK_PRICES, type PlanChoice } from './config';

export interface Price {
  /** In micros of the currency (1,000,000 = one unit), as Google Play reports it. */
  amountMicros: number;
  currency: string;
}

/** "₱999", "$9.99". Falls back to plain text if the runtime has no currency formatting. */
export function formatPrice(price: Price, locale?: string): string {
  const amount = price.amountMicros / 1_000_000;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: price.currency,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${price.currency} ${amount.toFixed(Number.isInteger(amount) ? 0 : 2)}`;
  }
}

export interface YearlySavings {
  /** What twelve monthly payments cost. */
  twelveMonthsMicros: number;
  /** What the yearly plan works out to per month. */
  perMonthMicros: number;
  savedMicros: number;
  /** Percentage saved, to one decimal place. */
  percent: number;
}

/**
 * How much the yearly plan saves against twelve monthly payments, from the prices actually being
 * charged (so it stays right when prices change or are localized). Null when the yearly plan
 * isn't cheaper, or the prices are in different currencies, so a wrong or negative saving is never shown.
 */
export function yearlySavings(monthly: Price, yearly: Price): YearlySavings | null {
  if (monthly.currency !== yearly.currency) return null;
  const twelveMonthsMicros = monthly.amountMicros * 12;
  const savedMicros = twelveMonthsMicros - yearly.amountMicros;
  if (twelveMonthsMicros <= 0 || savedMicros <= 0) return null;
  return {
    twelveMonthsMicros,
    perMonthMicros: Math.round(yearly.amountMicros / 12),
    savedMicros,
    percent: Math.round((savedMicros / twelveMonthsMicros) * 1000) / 10,
  };
}

/** Prices for the paywall. Google Play's prices replace these once billing is connected. */
export function paywallPrices(fromStore?: Partial<Record<PlanChoice, Price>>): Record<PlanChoice, Price> {
  return {
    monthly: fromStore?.monthly ?? FALLBACK_PRICES.monthly,
    yearly: fromStore?.yearly ?? FALLBACK_PRICES.yearly,
    lifetime: fromStore?.lifetime ?? FALLBACK_PRICES.lifetime,
  };
}
