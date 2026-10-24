export type Locale = 'uk' | 'en';

const STORAGE_KEY = 'clan.language';

export function resolveLocale(saved: string | null, browserLanguages: readonly string[]): Locale {
  if (saved === 'uk' || saved === 'en') return saved;

  for (const language of browserLanguages) {
    const baseLanguage = language.toLowerCase().split(/[-_]/, 1)[0];
    if (baseLanguage === 'uk' || baseLanguage === 'en') return baseLanguage;
  }

  return 'uk';
}

export function initialLocale(): Locale {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Browsers may block storage; their accepted languages remain available.
  }
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return resolveLocale(saved, languages);
}

export function rememberLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Keeping the in-memory preference still makes the current session usable.
  }
}
