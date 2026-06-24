import { getActiveLanguageCode, translatePhrase, type AppLang } from '../i18n';

/** Translate user-visible toast / API messages at display time. */
export function tt(text: string, lang?: AppLang): string {
  return translatePhrase(text, lang ?? getActiveLanguageCode());
}
