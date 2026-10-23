import { describe, it, expect } from 'vitest';
import { authPhone, SUBSCRIPTION_MONTHS, subscriptionExpiry } from './phoneRules';
import { MAX_DEVICES } from './licenseRules';
describe('phone subscriptions', () => {
  it('normalizes the designated admin phone', () => { expect(authPhone('0745260364')).toBe('+254745260364'); });
  it('supports every duration from one month through one year', () => { expect(SUBSCRIPTION_MONTHS).toEqual([1,2,3,4,5,6,7,8,9,10,11,12]); expect(() => subscriptionExpiry(new Date(),13)).toThrow(); });
  it('clamps calendar months without overflowing', () => { expect(subscriptionExpiry(new Date('2026-01-31T00:00:00Z'),1).toISOString()).toBe('2026-02-28T00:00:00.000Z'); });
  it('allows only two devices', () => { expect(MAX_DEVICES).toBe(2); });
});