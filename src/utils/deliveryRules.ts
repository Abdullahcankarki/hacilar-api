import { RegionRuleResource } from '@/Resources';
import { DateTime } from 'luxon';

export const ZONE = 'Europe/Berlin';

export function toDateOnlyInZone(jsDate: Date, zone: string): DateTime {
  const local = DateTime.fromJSDate(jsDate);
  return DateTime.fromObject(
    { year: local.year, month: local.month, day: local.day },
    { zone }
  ).startOf('day');
}

export function weekdayLuxon(dt: DateTime): number {
  return dt.setZone(ZONE).weekday;
}

export function isExceptionDate(dt: DateTime, rule: RegionRuleResource): boolean {
  if (!rule.exceptionDates?.length) return false;
  const ymd = dt.setZone(ZONE).toFormat('yyyy-LL-dd');
  return rule.exceptionDates.includes(ymd);
}

export function isPastCutoffForToday(candidate: DateTime, rule: RegionRuleResource, now: DateTime): boolean {
  if (!rule.orderCutoff) return false;
  if (candidate.setZone(ZONE).toISODate() !== now.setZone(ZONE).toISODate()) return false;
  const [hh, mm] = rule.orderCutoff.split(':').map(Number);
  const cutoff = now.set({ hour: hh, minute: mm, second: 0, millisecond: 0 });
  return now > cutoff;
}

export type AllowResult = { ok: true } | { ok: false; reason: 'inactive' | 'weekday' | 'exception' | 'cutoff' | 'past' };

export function isDateAllowed(date: Date, rule: RegionRuleResource, now: DateTime = DateTime.now().setZone(ZONE)): AllowResult {
  const dt = toDateOnlyInZone(date, ZONE);
  if (!rule.isActive) return { ok: false, reason: 'inactive' };
  if (dt < now.startOf('day')) return { ok: false, reason: 'past' };
  const wd = weekdayLuxon(dt);
  if (!rule.allowedWeekdays.includes(wd)) return { ok: false, reason: 'weekday' };
  if (isExceptionDate(dt, rule)) return { ok: false, reason: 'exception' };
  if (isPastCutoffForToday(dt, rule, now)) return { ok: false, reason: 'cutoff' };
  return { ok: true };
}

export function nextAllowedDate(startFrom: Date, rule: RegionRuleResource, maxLookaheadDays = 90): Date | null {
  let cursor = DateTime.fromJSDate(startFrom).setZone(ZONE).startOf('day');
  const now = DateTime.now().setZone(ZONE);
  for (let i = 0; i < maxLookaheadDays; i++) {
    const res = isDateAllowed(cursor.toJSDate(), rule, now);
    if (res.ok) return cursor.toJSDate();
    cursor = cursor.plus({ days: 1 });
  }
  return null;
}
