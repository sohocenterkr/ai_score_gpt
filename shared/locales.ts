export const supportedLocales = ["ko"] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export const defaultLocale: SupportedLocale = "ko";

export const localeLabels: Record<SupportedLocale, string> = {
  ko: "한국어",
};

export function isSupportedLocale(value: string | undefined): value is SupportedLocale {
  return Boolean(value && supportedLocales.includes(value as SupportedLocale));
}
