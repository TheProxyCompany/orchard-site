export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return Math.round(value).toLocaleString("en-US");
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value);
}

export function formatNumber(
  value: number | null | undefined,
  maximumFractionDigits = 1,
): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(value);
}

export function formatPercent(
  value: number | null | undefined,
  maximumFractionDigits = 1,
): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return `${value.toFixed(maximumFractionDigits)}%`;
}

export function formatCurrency(
  value: number | null | undefined,
  options: Intl.NumberFormatOptions = {},
): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    ...options,
  }).format(value);
}

export function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return "—";
  }

  const deltaSeconds = Math.round((timestamp - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];

  for (const [unit, seconds] of units) {
    if (Math.abs(deltaSeconds) >= seconds || unit === "minute") {
      return formatter.format(Math.round(deltaSeconds / seconds), unit);
    }
  }

  return "just now";
}

export function formatShortDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateTimeUtc(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "—";
  }

  const formatted = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);

  return formatted.replace(",", "");
}

export function formatMonthDayTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}
