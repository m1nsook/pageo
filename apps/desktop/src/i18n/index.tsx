import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type LocaleCatalog = {
  schemaVersion: number;
  locale: string;
  nativeName: string;
  englishName: string;
  direction: "ltr" | "rtl";
  messages: Record<string, string>;
};

/** Compile validated community translation snapshots into the offline Studio. */
const bundled = import.meta.glob<LocaleCatalog>("./locales/*.json", { eager: true, import: "default" });
const catalogs: Record<string, LocaleCatalog> = Object.fromEntries(Object.values(bundled).map(pack => [pack.locale, pack]));
export const LANGUAGES = Object.values(catalogs).sort((a,b) =>
  a.locale === "en" ? -1 : b.locale === "en" ? 1 : a.nativeName.localeCompare(b.nativeName)
).map(({ locale, nativeName, englishName, direction }) => ({ locale, nativeName, englishName, direction }));
const STORAGE_KEY = "paglora:studio-locale";
const supported = (value: string) => Object.prototype.hasOwnProperty.call(catalogs, value);

export function translate(locale: string, key: string, args: Record<string, string | number> = {}): string {
  const candidate = catalogs[locale]?.messages[key];
  const english = catalogs.en?.messages[key];
  const template = typeof candidate === "string" && candidate.trim() ? candidate : typeof english === "string" ? english : key;
  return template.replace(/\{([a-z][a-zA-Z0-9_]*)\}/g, (match, token: string) =>
    Object.prototype.hasOwnProperty.call(args, token) ? String(args[token]) : match);
}

type ContextValue = {
  locale: string;
  setLocale: (value: string) => void;
  t: (key: string, args?: Record<string, string | number>) => string;
};
const TranslationContext = createContext<ContextValue>({
  locale: "en", setLocale: () => undefined, t: (key, args) => translate("en", key, args),
});
export function TranslationProvider({ children }: { children: ReactNode }) {
  const [locale, changeLocale] = useState(() => {
    try { const saved = localStorage.getItem(STORAGE_KEY) || "en"; return supported(saved) ? saved : "en"; }
    catch { return "en"; }
  });
  const setLocale = useCallback((next: string) => {
    if (!supported(next)) return;
    changeLocale(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = catalogs[locale]?.direction ?? "ltr";
  }, [locale]);
  const t = useCallback((key: string, args?: Record<string, string | number>) =>
    translate(locale, key, args), [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}
export const useTranslation = () => useContext(TranslationContext);
