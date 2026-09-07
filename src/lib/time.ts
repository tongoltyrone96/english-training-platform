export function getAppTimeZone(): string {
  return process.env.APP_TIME_ZONE || "Europe/London";
}

export function zonedDateParts(date = new Date(), timeZone = getAppTimeZone()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), weekday: get("weekday") };
}

export function dateOnlyUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

export function localDateTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let result = target;
  for (let index = 0; index < 2; index++) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(result));
    const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
    const represented = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
    result += target - represented;
  }
  return new Date(result);
}

export function monthBounds(year: number, month: number) {
  return {
    start: dateOnlyUtc(year, month, 1),
    end: dateOnlyUtc(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1),
  };
}

export function isoWeekKey(date = new Date(), timeZone = getAppTimeZone()): string {
  const parts = zonedDateParts(date, timeZone);
  const local = dateOnlyUtc(parts.year, parts.month, parts.day);
  const isoDay = local.getUTCDay() || 7;
  local.setUTCDate(local.getUTCDate() + 4 - isoDay);
  const isoYear = local.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil((((local.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

export function isoWeekDateBounds(date = new Date(), timeZone = getAppTimeZone()) {
  const parts = zonedDateParts(date, timeZone);
  const local = dateOnlyUtc(parts.year, parts.month, parts.day);
  const isoDay = local.getUTCDay() || 7;
  local.setUTCDate(local.getUTCDate() - isoDay + 1);
  const end = new Date(local); end.setUTCDate(end.getUTCDate() + 7);
  return { start: local, end };
}
