import { FALLBACK_PRICES } from './config';
import { formatPrice, paywallPrices, yearlySavings } from './pricing';

describe('yearlySavings', () => {
  it('works out the saving from the configured prices (129 a month, 999 a year)', () => {
    const savings = yearlySavings(FALLBACK_PRICES.monthly, FALLBACK_PRICES.yearly);
    expect(savings).toEqual({
      twelveMonthsMicros: 1_548_000_000,
      perMonthMicros: 83_250_000,
      savedMicros: 549_000_000,
      percent: 35.5,
    });
  });

  it('follows the prices, so a price change needs no code change', () => {
    const savings = yearlySavings(
      { amountMicros: 100_000_000, currency: 'PHP' },
      { amountMicros: 600_000_000, currency: 'PHP' },
    );
    expect(savings).toMatchObject({ savedMicros: 600_000_000, percent: 50, perMonthMicros: 50_000_000 });
  });

  it('works for any currency Play returns', () => {
    const savings = yearlySavings(
      { amountMicros: 2_990_000, currency: 'USD' },
      { amountMicros: 24_990_000, currency: 'USD' },
    );
    expect(savings?.percent).toBe(30.4);
  });

  it('shows no saving when there is none, or the data is unusable', () => {
    expect(yearlySavings({ amountMicros: 100_000_000, currency: 'PHP' }, { amountMicros: 1_200_000_000, currency: 'PHP' })).toBeNull();
    expect(yearlySavings({ amountMicros: 100_000_000, currency: 'PHP' }, { amountMicros: 1_500_000_000, currency: 'PHP' })).toBeNull();
    expect(yearlySavings({ amountMicros: 0, currency: 'PHP' }, { amountMicros: 1, currency: 'PHP' })).toBeNull();
    // Never compare prices in different currencies.
    expect(yearlySavings({ amountMicros: 129_000_000, currency: 'PHP' }, { amountMicros: 9_990_000, currency: 'USD' })).toBeNull();
  });
});

describe('formatPrice', () => {
  it('formats whole and fractional amounts', () => {
    expect(formatPrice({ amountMicros: 999_000_000, currency: 'PHP' }, 'en-PH')).toMatch(/999/);
    expect(formatPrice({ amountMicros: 83_250_000, currency: 'PHP' }, 'en-PH')).toMatch(/83\.25/);
    expect(formatPrice({ amountMicros: 999_000_000, currency: 'PHP' }, 'en-PH')).not.toMatch(/999\.00/);
  });

  it('survives a currency code the runtime does not know', () => {
    expect(formatPrice({ amountMicros: 5_000_000, currency: 'zzzz' })).toContain('5');
  });
});

describe('paywallPrices', () => {
  it('uses the store price when there is one and the fallback otherwise', () => {
    const prices = paywallPrices({ yearly: { amountMicros: 1_100_000_000, currency: 'PHP' } });
    expect(prices.yearly.amountMicros).toBe(1_100_000_000);
    expect(prices.monthly).toEqual(FALLBACK_PRICES.monthly);
    expect(prices.lifetime).toEqual(FALLBACK_PRICES.lifetime);
  });
});
