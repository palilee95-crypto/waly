import { useCallback } from 'react';
import { useLanguage, type Locale } from '@/context/LanguageContext';

export type TranslateVars = Record<string, string | number>;
export type Tr = (en: string, ms: string, vars?: TranslateVars) => string;

/**
 * Locale-pair translator for screen-specific copy.
 *
 * `t('key')` stays the right tool for shared vocabulary; this is for the long
 * tail of alerts, empty states and placeholders where a dictionary key would
 * add indirection without any reuse. Both languages sit at the call site, so a
 * string can never ship English-only.
 */
export function translate(locale: Locale, en: string, ms: string, vars?: TranslateVars): string {
  let out = locale === 'ms' ? ms : en;
  if (vars) {
    for (const key of Object.keys(vars)) {
      out = out.split(`{{${key}}}`).join(String(vars[key]));
    }
  }
  return out;
}

export function useTr(): Tr {
  const { locale } = useLanguage();
  return useCallback<Tr>(
    (en, ms, vars) => translate(locale, en, ms, vars),
    [locale]
  );
}
