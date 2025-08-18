import { DateTime, Interval } from "luxon";

export const EXCHANGE_TZ = process.env.NEXT_PUBLIC_EXCHANGE_TZ || "America/Sao_Paulo";

export function toExchangeDateTime(epochMs: number): DateTime {
  return DateTime.fromMillis(epochMs, { zone: EXCHANGE_TZ });
}

export function startOfMinuteBucket(epochMs: number, minuteSize: number): number {
  const dt = toExchangeDateTime(epochMs);
  const flooredMinute = Math.floor(dt.minute / minuteSize) * minuteSize;
  const bucket = dt.set({ second: 0, millisecond: 0, minute: flooredMinute });
  return bucket.toUTC().toMillis();
}

export function startOfHourBucket(epochMs: number, hourSize: number): number {
  const dt = toExchangeDateTime(epochMs);
  const flooredHour = Math.floor(dt.hour / hourSize) * hourSize;
  const bucket = dt.set({ minute: 0, second: 0, millisecond: 0, hour: flooredHour });
  return bucket.toUTC().toMillis();
}

export function startOfDay(epochMs: number): number {
  const dt = toExchangeDateTime(epochMs).startOf("day");
  return dt.toUTC().toMillis();
}

export function startOfISOWeek(epochMs: number): number {
  const dt = toExchangeDateTime(epochMs).startOf("week");
  return dt.toUTC().toMillis();
}

export function formatTime(epochSeconds: number): string {
  // epochSeconds expected by lightweight-charts formatters
  const dt = DateTime.fromSeconds(epochSeconds, { zone: EXCHANGE_TZ });
  return dt.toFormat("HH:mm");
}

export function formatFullDateTime(epochSeconds: number): string {
  const dt = DateTime.fromSeconds(epochSeconds, { zone: EXCHANGE_TZ });
  // Example: 15:42 - 04 set. '24
  const monthShort = dt.setLocale("pt-BR").toFormat("LLL");
  const yearShort = dt.toFormat("yy");
  return `${dt.toFormat("HH:mm")} - ${dt.toFormat("dd")} ${monthShort}. '${yearShort}`;
}


