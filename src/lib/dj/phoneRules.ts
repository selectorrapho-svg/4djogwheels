export function authPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  const phone = /^0[71]\d{8}$/.test(digits) ? `254${digits.slice(1)}` : /^[71]\d{8}$/.test(digits) ? `254${digits}` : digits;
  if (!/^[1-9]\d{9,14}$/.test(phone)) throw new Error('Enter a valid phone number, including country code outside Kenya.');
  return `+${phone}`;
}
export const SUBSCRIPTION_MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12] as const;
export function subscriptionExpiry(now: Date, months: number): Date {
  if (!SUBSCRIPTION_MONTHS.some(m => m === months)) throw new Error('Choose 1–12 months.');
  const date = new Date(now), day = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last)); return date;
}