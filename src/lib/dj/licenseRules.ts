export const PRO_MONTHS = [1, 2, 3, 4, 5, 6, 7, 12] as const;
export const MAX_DEVICES = 2;
export function validProMonths(value: number): value is typeof PRO_MONTHS[number] { return PRO_MONTHS.some(m => m === value); }
export function addProMonths(date: Date, months: number) {
  if (!validProMonths(months)) throw new Error('Invalid Pro duration');
  const result = new Date(date); const day = result.getUTCDate(); result.setUTCDate(1); result.setUTCMonth(result.getUTCMonth() + months);
  const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate(); result.setUTCDate(Math.min(day, last)); return result;
}
export type OfflineEntitlement = { userId: string; name: string; phone: string; device: string; until: number };
export function canUseStudio(entitlement: OfflineEntitlement | null, userId: string, device: string, now: number) { return !!entitlement && entitlement.userId === userId && entitlement.device === device && entitlement.until > now; }
