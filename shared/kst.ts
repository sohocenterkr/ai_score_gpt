export const KST_TIME_ZONE = "Asia/Seoul";
export const KST_OFFSET = "+09:00";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toDate(value: Date | string | number): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("유효하지 않은 날짜 값입니다.");
  }
  return date;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

function getKSTParts(value: Date | string | number): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
} {
  const shifted = new Date(toDate(value).getTime() + KST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    millisecond: shifted.getUTCMilliseconds(),
  };
}

export function getTodayKST(value: Date | string | number = new Date()): string {
  const parts = getKSTParts(value);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function toKSTDateTime(value: Date | string | number = new Date()): string {
  const parts = getKSTParts(value);
  return [
    `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    `T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}.${pad(parts.millisecond, 3)}`,
    KST_OFFSET,
  ].join("");
}

export function getNowKST(value: Date | string | number = new Date()): string {
  return toKSTDateTime(value);
}

export function formatKST(
  value: Date | string | number,
  locale = "ko-KR",
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(toDate(value));
}

export function getEndOfKSTDay(value: Date | string | number = new Date()): Date {
  const dateText =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value
      : getTodayKST(value);
  return new Date(`${dateText}T23:59:59.999${KST_OFFSET}`);
}

export function getNextKSTMidnight(value: Date | string | number = new Date()): Date {
  const currentMidnight = new Date(`${getTodayKST(value)}T00:00:00.000${KST_OFFSET}`);
  return new Date(currentMidnight.getTime() + 24 * 60 * 60 * 1000);
}
