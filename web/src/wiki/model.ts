export type WikiLocale = 'en' | 'uk';
export type WikiCategory = 'start' | 'wars' | 'combat' | 'progress' | 'research';
export type WikiLevel = 'beginner' | 'intermediate' | 'advanced';
export type Evidence = 'practical' | 'observed' | 'theory';
export type Translation = Record<WikiLocale, string>;

export interface WikiArticle {
  id: string;
  category: WikiCategory;
  level: WikiLevel;
  evidence: Evidence;
  featured?: boolean;
  title: Translation;
  summary: Translation;
  body: Translation;
  related?: string[];
  links?: { label: Translation; url: string }[];
}

export const wikiCategories: { id: WikiCategory; title: Translation; subtitle: Translation }[] = [
  {
    id: 'start',
    title: { en: 'Getting started', uk: 'Початок гри' },
    subtitle: { en: 'Everything new members need', uk: 'Усе для нових учасників' },
  },
  {
    id: 'wars',
    title: { en: 'Clan wars', uk: 'Війни кланів' },
    subtitle: { en: 'Win together, spend wisely', uk: 'Перемагаймо разом, витрачаймо розумно' },
  },
  {
    id: 'combat',
    title: { en: 'Builds & combat', uk: 'Білди та бій' },
    subtitle: { en: 'Stats, affixes and tactics', uk: 'Характеристики, афікси й тактика' },
  },
  {
    id: 'progress',
    title: { en: 'Progression', uk: 'Розвиток' },
    subtitle: { en: 'Gear, currencies and game modes', uk: 'Спорядження, ресурси та режими' },
  },
  {
    id: 'research',
    title: { en: 'Research & tools', uk: 'Дослідження' },
    subtitle: {
      en: 'Experiments, tools and open questions',
      uk: 'Експерименти, інструменти та питання',
    },
  },
];
