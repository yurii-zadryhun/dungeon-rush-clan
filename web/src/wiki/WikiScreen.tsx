import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookOpen,
  Clock3,
  Compass,
  FlaskConical,
  Search,
  Shield,
  Swords,
  TrendingUp,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { articleById, wikiArticles } from './catalog';
import { articleHeadings, WikiMarkdown } from './WikiMarkdown';
import { wikiMessages } from './messages';
import { wikiCategories, type WikiArticle, type WikiCategory, type WikiLocale } from './model';
import './wiki.css';

const categoryIcons: Record<WikiCategory, LucideIcon> = {
  start: Compass,
  wars: Swords,
  combat: Shield,
  progress: TrendingUp,
  research: FlaskConical,
};

const SAVED_KEY = 'clan.wiki.saved';

function readSaved(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function readingMinutes(article: WikiArticle, locale: WikiLocale): number {
  return Math.max(2, Math.ceil(article.body[locale].split(/\s+/).length / 210));
}

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/[\u0300-\u036f]/g, '');
}

function GuideCard({
  article,
  locale,
  bookmarked,
  onBookmark,
  compact = false,
}: {
  article: WikiArticle;
  locale: WikiLocale;
  bookmarked: boolean;
  onBookmark: (id: string) => void;
  compact?: boolean;
}) {
  const m = wikiMessages(locale);
  const category = wikiCategories.find((item) => item.id === article.category)!;
  const Icon = categoryIcons[article.category];

  return (
    <article className={'wiki-guide-card' + (compact ? ' wiki-guide-compact' : '')}>
      <div className="wiki-guide-top">
        <span className={'wiki-guide-icon wiki-icon-' + article.category}>
          <Icon size={21} />
        </span>
        <button
          type="button"
          className={'wiki-bookmark' + (bookmarked ? ' is-saved' : '')}
          onClick={() => onBookmark(article.id)}
          title={bookmarked ? m.unsave : m.save}
          aria-label={bookmarked ? m.unsave : m.save}
          aria-pressed={bookmarked}
        >
          <Bookmark size={18} fill={bookmarked ? 'currentColor' : 'none'} />
        </button>
      </div>
      <a className="wiki-guide-body" href={'#/wiki/' + article.id}>
        <span className="wiki-guide-category">{category.title[locale]}</span>
        <h3>{article.title[locale]}</h3>
        <p>{article.summary[locale]}</p>
        <div className="wiki-guide-footer">
          <span>
            <Clock3 size={13} /> {readingMinutes(article, locale)} {m.min}
          </span>
          <span>{m[article.level]}</span>
          <ArrowRight size={17} className="wiki-guide-arrow" />
        </div>
      </a>
    </article>
  );
}

export function WikiScreen({ articleId }: { articleId?: string }) {
  const { locale } = useI18n();
  const m = wikiMessages(locale);
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState<WikiCategory | 'all'>('all');
  const [savedOnly, setSavedOnly] = React.useState(false);
  const [saved, setSaved] = React.useState<string[]>(readSaved);
  const selectedArticle = articleId ? articleById.get(articleId) : undefined;
  const selectedCategory = selectedArticle?.category ?? category;
  const savedIds = React.useMemo(() => new Set(saved), [saved]);

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [articleId]);

  function toggleBookmark(id: string) {
    setSaved((previous) => {
      const next = previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id];
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      } catch {
        // Bookmarks remain available during the current visit.
      }
      return next;
    });
  }

  function selectCategory(next: WikiCategory | 'all') {
    setCategory(next);
    setSavedOnly(false);
    if (articleId) window.location.hash = '#/wiki';
  }

  const filtered = React.useMemo(() => {
    const phrase = normalize(query.trim());
    return wikiArticles.filter((article) => {
      if (category !== 'all' && article.category !== category) return false;
      if (savedOnly && !savedIds.has(article.id)) return false;
      if (!phrase) return true;
      const text = [
        article.title[locale],
        article.title.en,
        article.summary[locale],
        article.summary.en,
        article.body[locale],
        article.body.en,
      ].join(' ');
      return normalize(text).includes(phrase);
    });
  }, [query, category, savedOnly, savedIds, locale]);

  const showFeatured = !query.trim() && category === 'all' && !savedOnly;
  const recommendations = ['war-calendar', 'gear-130', 'affixes']
    .map((id) => articleById.get(id))
    .filter((article): article is WikiArticle => Boolean(article));
  const list = showFeatured
    ? filtered.filter((article) => !recommendations.some((guide) => guide.id === article.id))
    : filtered;

  const toc = selectedArticle ? articleHeadings(selectedArticle.body[locale]) : [];
  const statusDetails = selectedArticle?.evidence === 'theory' ? m.theoryHelp : m.evidenceHelp;

  return (
    <main className="wiki-page">
      <div className="wiki-shell">
        <aside className="wiki-sidebar" aria-label={m.categories}>
          <div className="wiki-sidebar-heading">
            <BookOpen size={19} /> <span>{m.home}</span>
          </div>
          <p className="wiki-sidebar-label">{m.categories}</p>
          <nav className="wiki-category-nav">
            <button
              className={selectedCategory === 'all' ? 'active' : ''}
              onClick={() => selectCategory('all')}
              type="button"
            >
              <BookOpen size={17} /> <span>{m.all}</span>
              <small>{wikiArticles.length}</small>
            </button>
            {wikiCategories.map((item) => {
              const Icon = categoryIcons[item.id];
              return (
                <button
                  key={item.id}
                  className={selectedCategory === item.id ? 'active' : ''}
                  onClick={() => selectCategory(item.id)}
                  type="button"
                >
                  <Icon size={17} />
                  <span>{item.title[locale]}</span>
                  <small>{wikiArticles.filter((article) => article.category === item.id).length}</small>
                </button>
              );
            })}
          </nav>
          <div className="wiki-sidebar-footer">
            <span className="wiki-lang-dot" /> {m.allLanguages}
          </div>
        </aside>

        {articleId ? (
          selectedArticle ? (
            <div className="wiki-article-layout">
              <article className="wiki-article">
                <a className="wiki-back-link" href="#/wiki">
                  <ArrowLeft size={17} /> {m.back}
                </a>
                <div className="wiki-article-heading">
                  <div className="wiki-article-meta">
                    <span>
                      {
                        wikiCategories.find((item) => item.id === selectedArticle.category)?.title[
                          locale
                        ]
                      }
                    </span>
                    <span className="wiki-meta-dot" />
                    <span>{m[selectedArticle.level]}</span>
                    <span className="wiki-meta-dot" />
                    <span>
                      {readingMinutes(selectedArticle, locale)} {m.min}
                    </span>
                  </div>
                  <h1>{selectedArticle.title[locale]}</h1>
                  <p className="wiki-article-summary">{selectedArticle.summary[locale]}</p>
                  <div className="wiki-article-actions">
                    <span className={'wiki-evidence wiki-evidence-' + selectedArticle.evidence}>
                      {m[selectedArticle.evidence]}
                    </span>
                    <button
                      type="button"
                      className={
                        'wiki-save-action' + (savedIds.has(selectedArticle.id) ? ' is-saved' : '')
                      }
                      onClick={() => toggleBookmark(selectedArticle.id)}
                      aria-pressed={savedIds.has(selectedArticle.id)}
                    >
                      <Bookmark
                        size={16}
                        fill={savedIds.has(selectedArticle.id) ? 'currentColor' : 'none'}
                      />
                      {savedIds.has(selectedArticle.id) ? m.unsave : m.save}
                    </button>
                  </div>
                </div>
                <div className="wiki-content-sheet">
                  <div className="wiki-context-note">{statusDetails}</div>
                  <WikiMarkdown content={selectedArticle.body[locale]} />
                  {selectedArticle.links?.length ? (
                    <div className="wiki-resources">
                      <h2>{m.resources}</h2>
                      {selectedArticle.links.map((link) => (
                        <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">
                          {link.label[locale]} <ArrowRight size={15} />
                        </a>
                      ))}
                    </div>
                  ) : null}
                  <p className="wiki-published">{m.updated}</p>
                </div>
                {!!selectedArticle.related?.length && (
                  <section className="wiki-related">
                    <h2>{m.related}</h2>
                    <div className="wiki-card-grid">
                      {selectedArticle.related
                        .map((id) => articleById.get(id))
                        .filter((article): article is WikiArticle => Boolean(article))
                        .slice(0, 4)
                        .map((article) => (
                          <GuideCard
                            key={article.id}
                            article={article}
                            locale={locale}
                            bookmarked={savedIds.has(article.id)}
                            onBookmark={toggleBookmark}
                            compact
                          />
                        ))}
                    </div>
                  </section>
                )}
              </article>

              {toc.length > 0 && (
                <aside className="wiki-toc">
                  <div className="wiki-toc-inner">
                    <strong>{m.toc}</strong>
                    {toc.map((heading) => (
                      <button
                        key={heading.section}
                        type="button"
                        onClick={() =>
                          document
                            .getElementById('wiki-section-' + heading.section)
                            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }
                      >
                        {heading.title}
                      </button>
                    ))}
                  </div>
                </aside>
              )}
            </div>
          ) : (
            <div className="wiki-empty-state">
              <BookOpen size={40} />
              <h1>{m.notFound}</h1>
              <p>{m.notFoundHelp}</p>
              <a className="wiki-return-button" href="#/wiki">
                {m.back} <ArrowRight size={17} />
              </a>
            </div>
          )
        ) : (
          <div className="wiki-home">
            <header className="wiki-hero">
              <div className="wiki-hero-content">
                <span className="wiki-hero-eyebrow">
                  <span /> {m.eyebrow}
                </span>
                <h1>{m.title}</h1>
                <p>{m.subtitle}</p>
                <div className="wiki-hero-stats">
                  <span>
                    <BookOpen size={16} /> {wikiArticles.length} {m.guides}
                  </span>
                  <span>
                    {wikiCategories.length} {m.categories.toLocaleLowerCase(locale)}
                  </span>
                  <span>UA / EN</span>
                </div>
              </div>
              <div className="wiki-hero-art" aria-hidden="true">
                <div className="wiki-art-ring">
                  <Shield size={82} strokeWidth={1.2} />
                </div>
                <span>DR</span>
              </div>
            </header>

            <div className="wiki-controls">
              <div className="wiki-search">
                <Search size={20} />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={m.search}
                  aria-label={m.search}
                />
                {query && (
                  <button type="button" aria-label={m.clear} onClick={() => setQuery('')}>
                    <X size={17} />
                  </button>
                )}
              </div>
              <button
                type="button"
                className={'wiki-saved-filter' + (savedOnly ? ' active' : '')}
                onClick={() => setSavedOnly((value) => !value)}
                aria-pressed={savedOnly}
              >
                <Bookmark size={17} fill={savedOnly ? 'currentColor' : 'none'} /> {m.saved}{' '}
                <span>{saved.length}</span>
              </button>
            </div>

            <div className="wiki-mobile-categories" aria-label={m.categories}>
              <button
                type="button"
                className={category === 'all' ? 'active' : ''}
                onClick={() => selectCategory('all')}
              >
                {m.all}
              </button>
              {wikiCategories.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={category === item.id ? 'active' : ''}
                  onClick={() => selectCategory(item.id)}
                >
                  {item.title[locale]}
                </button>
              ))}
            </div>

            {showFeatured && (
              <section className="wiki-featured">
                <div className="wiki-section-heading">
                  <div>
                    <span className="wiki-overline">01 / {m.featured}</span>
                    <h2>{m.featured}</h2>
                    <p>{m.quickStart}</p>
                  </div>
                </div>
                <div className="wiki-card-grid wiki-featured-grid">
                  {recommendations.map((article) => (
                    <GuideCard
                      key={article.id}
                      article={article}
                      locale={locale}
                      bookmarked={savedIds.has(article.id)}
                      onBookmark={toggleBookmark}
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="wiki-library">
              <div className="wiki-section-heading">
                <div>
                  <span className="wiki-overline">02 / {m.browse}</span>
                  <h2>
                    {category === 'all'
                      ? m.browse
                      : wikiCategories.find((item) => item.id === category)?.title[locale]}
                  </h2>
                </div>
                <span className="wiki-result-count">
                  {list.length} {m.articleCount}
                </span>
              </div>
              {list.length ? (
                <div className="wiki-card-grid">
                  {list.map((article) => (
                    <GuideCard
                      key={article.id}
                      article={article}
                      locale={locale}
                      bookmarked={savedIds.has(article.id)}
                      onBookmark={toggleBookmark}
                    />
                  ))}
                </div>
              ) : (
                <div className="wiki-empty-state">
                  <Search size={35} />
                  <h2>{savedOnly && !query ? m.noSaved : m.noResults}</h2>
                  <p>{savedOnly && !query ? m.noSavedHelp : m.noResultsHelp}</p>
                  <button
                    type="button"
                    className="wiki-return-button"
                    onClick={() => {
                      setQuery('');
                      setCategory('all');
                      setSavedOnly(false);
                    }}
                  >
                    {m.reset} <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
