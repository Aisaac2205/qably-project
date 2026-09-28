import { resolveNumberLocale } from "@/lib/i18n";

const FALLBACK_LOCALE = "en-US";

const dateCache = new Map<string, Intl.DateTimeFormat>();
const numberCache = new Map<string, Intl.NumberFormat>();

/**
 * Charts read the locale from the document, which `I18nProvider` keeps in sync
 * with the active locale. Reading it per call keeps axis ticks and tooltips in
 * the user's language without coupling these vendored files to the app store.
 */
function activeLocale(): string {
  if (typeof document === "undefined") {
    return FALLBACK_LOCALE;
  }
  const lang = document.documentElement.lang;
  return lang ? lang : FALLBACK_LOCALE;
}

function dateFormatter(
  key: string,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  const locale = activeLocale();
  const cacheKey = `${key}:${locale}`;
  const cached = dateCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const created = new Intl.DateTimeFormat(locale, options);
  dateCache.set(cacheKey, created);
  return created;
}

function numberFormatter(): Intl.NumberFormat {
  const locale = resolveNumberLocale(activeLocale());
  const cached = numberCache.get(locale);
  if (cached) {
    return cached;
  }
  const created = new Intl.NumberFormat(locale);
  numberCache.set(locale, created);
  return created;
}

export const shortDateFmt = {
  format: (date: Date) =>
    dateFormatter("short", { month: "short", day: "numeric" }).format(date),
};

export const weekdayDateFmt = {
  format: (date: Date) =>
    dateFormatter("weekday", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(date),
};

export const hmsTimeFmt = {
  format: (date: Date) =>
    dateFormatter("hms", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date),
};

export const intFmt = (value: number) => numberFormatter().format(value);
