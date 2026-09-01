/**
 * Supported UI languages.
 *
 * `dir` drives the document's text direction — Arabic and Urdu are RTL, and the
 * layout mirrors via CSS logical properties rather than per-language overrides.
 */
export type AppLang =
  | 'en'
  | 'ar' | 'ur'                                    // right-to-left
  | 'hi' | 'bn' | 'te' | 'mr' | 'ta' | 'gu' | 'kn' | 'ml';

export type TextDir = 'ltr' | 'rtl';

export interface LanguageMeta {
  code: AppLang;
  /** English name, for accessibility and admin surfaces. */
  label: string;
  /** Endonym — what speakers call the language. Shown in the picker. */
  nativeLabel: string;
  /** Short badge for the compact switcher. */
  short: string;
  dir: TextDir;
}

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  { code: 'en', label: 'English',   nativeLabel: 'English',   short: 'EN', dir: 'ltr' },
  { code: 'ar', label: 'Arabic',    nativeLabel: 'العربية',    short: 'ع',  dir: 'rtl' },
  { code: 'ur', label: 'Urdu',      nativeLabel: 'اردو',       short: 'اُ', dir: 'rtl' },
  { code: 'hi', label: 'Hindi',     nativeLabel: 'हिन्दी',      short: 'हि', dir: 'ltr' },
  { code: 'bn', label: 'Bengali',   nativeLabel: 'বাংলা',      short: 'বা', dir: 'ltr' },
  { code: 'te', label: 'Telugu',    nativeLabel: 'తెలుగు',     short: 'తె', dir: 'ltr' },
  { code: 'mr', label: 'Marathi',   nativeLabel: 'मराठी',      short: 'म',  dir: 'ltr' },
  { code: 'ta', label: 'Tamil',     nativeLabel: 'தமிழ்',      short: 'த',  dir: 'ltr' },
  { code: 'gu', label: 'Gujarati',  nativeLabel: 'ગુજરાતી',    short: 'ગુ', dir: 'ltr' },
  { code: 'kn', label: 'Kannada',   nativeLabel: 'ಕನ್ನಡ',      short: 'ಕ',  dir: 'ltr' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം',    short: 'മ',  dir: 'ltr' },
];

const BY_CODE = new Map(SUPPORTED_LANGUAGES.map((l) => [l.code, l]));

export function languageMeta(code: AppLang): LanguageMeta {
  return BY_CODE.get(code) ?? SUPPORTED_LANGUAGES[0];
}

export function isSupportedLang(code: string): code is AppLang {
  return BY_CODE.has(code as AppLang);
}

export function dirFor(code: AppLang): TextDir {
  return languageMeta(code).dir;
}

export const RTL_LANGS = SUPPORTED_LANGUAGES.filter((l) => l.dir === 'rtl').map((l) => l.code);
