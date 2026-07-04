export const supportedLocales = ["ko", "en"] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export const defaultLocale: SupportedLocale = "ko";

export const localeLabels: Record<SupportedLocale, string> = {
  ko: "한국어",
  en: "English",
};

export function isSupportedLocale(value: string | undefined): value is SupportedLocale {
  return Boolean(value && supportedLocales.includes(value as SupportedLocale));
}
