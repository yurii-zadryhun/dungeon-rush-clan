import React from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Bot, Send, Sparkles, UserRound } from 'lucide-react';
import { api, json } from '../api';
import { useI18n } from '../i18n';
import { WikiMarkdown } from './WikiMarkdown';
import './ai.css';

interface Source {
  id: string;
  title: string;
  evidence: 'practical' | 'observed' | 'theory';
}
interface Reply {
  answer: string;
  sources: Source[];
  cached: boolean;
}
interface Message {
  role: 'user' | 'assistant';
  text: string;
  sources?: Source[];
}

const translations = {
  uk: {
    eyebrow: 'ПОРАДНИК КЛАНУ',
    title: 'Запитай у wiki',
    subtitle:
      'Став запитання про війну, білди, афікси та розвиток. Відповіді ґрунтуються на гайдах нашого клану.',
    placeholder: 'Наприклад: як захиститися від критів у PvP?',
    send: 'Надіслати',
    thinking: 'Шукаю відповідь у wiki...',
    suggestions: 'Із чого почати',
    examples: ['Як працює CDT -100%?', 'Коли варто витрачати кістки?', 'Як прокачати Divine до 130?'],
    sources: 'Матеріали wiki',
    note: 'Питання та релевантні уривки wiki надсилаються Google Gemma. Дані акаунта не передаються.',
    openWiki: 'До гайдів',
    status: 'Gemma 4 31B · безкоштовний режим',
    unavailable: 'AI поки не налаштовано. Гайди й пошук по wiki доступні як завжди.',
    unknown: 'Не вдалося отримати відповідь. Спробуй ще раз.',
    limits: {
      AI_BUSY: 'AI зараз зайнятий іншими запитами. Спробуй ще раз трохи пізніше.',
      AI_RATE_LIMIT: 'Тимчасово вичерпано ліміт запитів за хвилину. Спробуй пізніше.',
      AI_DAILY_LIMIT: 'Денний безкоштовний ліміт вичерпано.',
      AI_PROVIDER_LIMIT: 'Google тимчасово обмежив запити до моделі.',
      AI_PROVIDER_ERROR: 'AI зараз недоступний. Спробуй пізніше.',
      AI_UNAVAILABLE: 'AI ще не налаштований на сервері.',
      AI_INVALID_QUESTION: 'Введи запитання довжиною від 3 до 400 символів.',
    },
  },
  en: {
    eyebrow: 'CLAN KNOWLEDGE ASSISTANT',
    title: 'Ask the wiki',
    subtitle: 'Ask about wars, builds, affixes and progression. Answers come from our clan guides.',
    placeholder: 'For example: how do I counter critical hits in PvP?',
    send: 'Send',
    thinking: 'Searching the wiki...',
    suggestions: 'Try asking',
    examples: [
      'How does CDT -100% work?',
      'When should I spend bones?',
      'How do I level Divine gear to 130?',
    ],
    sources: 'Wiki sources',
    note: 'Your question and relevant wiki excerpts are sent to Google Gemma. Account details are not shared.',
    openWiki: 'Browse guides',
    status: 'Gemma 4 31B · free-tier mode',
    unavailable: 'AI is not configured yet. All wiki guides and search remain available.',
    unknown: 'Could not get an answer. Please try again.',
    limits: {
      AI_BUSY: 'AI is handling other questions. Please try again shortly.',
      AI_RATE_LIMIT: 'The per-minute request limit has been reached. Please try again later.',
      AI_DAILY_LIMIT: 'The daily free quota has been reached.',
      AI_PROVIDER_LIMIT: 'Google is temporarily limiting model requests.',
      AI_PROVIDER_ERROR: 'AI is temporarily unavailable. Please try again later.',
      AI_UNAVAILABLE: 'AI is not configured on the server yet.',
      AI_INVALID_QUESTION: 'Your question should be between 3 and 400 characters.',
    },
  },
} as const;

function errorText(message: string, locale: 'uk' | 'en'): string {
  const dictionary = translations[locale];
  const code = message as keyof typeof dictionary.limits;
  return dictionary.limits[code] ?? dictionary.unknown;
}

export function WikiAssistant() {
  const { locale } = useI18n();
  const t = translations[locale];
  const [enabled, setEnabled] = React.useState<boolean | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const bottom = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let active = true;
    api<{ enabled: boolean }>('wiki-ai/status')
      .then((status) => {
        if (active) setEnabled(status.enabled);
      })
      .catch(() => {
        if (active) setEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, busy]);

  async function ask(raw: string) {
    const question = raw.trim();
    if (!enabled || busy || question.length < 3 || question.length > 400) return;

    const recent = messages.slice(-2);
    const previous =
      recent.length === 2 && recent[0].role === 'user' && recent[1].role === 'assistant'
        ? { question: recent[0].text.slice(0, 250), answer: recent[1].text.slice(0, 500) }
        : undefined;
    setMessages((current) => [...current, { role: 'user', text: question }]);
    setInput('');
    setBusy(true);
    setError('');
    try {
      const result = await api<Reply>('wiki-ai/ask', json('POST', { question, locale, previous }));
      setMessages((current) => [
        ...current,
        { role: 'assistant', text: result.answer, sources: result.sources },
      ]);
    } catch (failure) {
      setError(errorText((failure as Error).message, locale));
      setInput(question);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="wiki-ai-page" aria-labelledby="wiki-ai-title">
      <a className="wiki-back-link" href="#/wiki">
        <ArrowLeft size={17} /> {t.openWiki}
      </a>
      <header className="wiki-ai-header">
        <div className="wiki-ai-logo">
          <Sparkles size={27} />
        </div>
        <div>
          <span className="wiki-overline">{t.eyebrow}</span>
          <h1 id="wiki-ai-title">{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
      </header>
      <div className="wiki-ai-window">
        <div
          className="wiki-ai-conversation"
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {messages.length === 0 && (
            <div className="wiki-ai-intro">
              <span className="wiki-ai-intro-icon">
                <Bot size={31} />
              </span>
              <h2>{t.suggestions}</h2>
              <div className="wiki-ai-prompts">
                {t.examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    disabled={!enabled || busy}
                    onClick={() => void ask(example)}
                  >
                    {example} <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message, index) => (
            <div className={'wiki-ai-message wiki-ai-message-' + message.role} key={index}>
              <span className="wiki-ai-avatar">
                {message.role === 'user' ? <UserRound size={16} /> : <Sparkles size={16} />}
              </span>
              <div className="wiki-ai-bubble">
                {message.role === 'assistant' ? (
                  <WikiMarkdown content={message.text} />
                ) : (
                  <p>{message.text}</p>
                )}
                {message.sources?.length ? (
                  <div className="wiki-ai-sources">
                    <small>{t.sources}</small>
                    <div>
                      {message.sources.map((source) => (
                        <a href={'#/wiki/' + source.id} key={source.id}>
                          <BookOpen size={13} /> {source.title} <ArrowRight size={12} />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {busy && (
            <div className="wiki-ai-message wiki-ai-message-assistant">
              <span className="wiki-ai-avatar">
                <Sparkles size={16} />
              </span>
              <div className="wiki-ai-bubble wiki-ai-thinking">
                <span className="spinner" /> {t.thinking}
              </div>
            </div>
          )}
          <div ref={bottom} />
        </div>
        <div className="wiki-ai-compose">
          {enabled === false && <div className="wiki-ai-alert">{t.unavailable}</div>}
          {error && (
            <div className="wiki-ai-alert" role="alert">
              {error}
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void ask(input);
            }}
            className="wiki-ai-form"
          >
            <textarea
              aria-label={t.placeholder}
              placeholder={t.placeholder}
              value={input}
              rows={2}
              maxLength={400}
              disabled={!enabled || busy}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void ask(input);
                }
              }}
            />
            <button
              type="submit"
              aria-label={t.send}
              title={t.send}
              disabled={!enabled || busy || input.trim().length < 3}
            >
              <Send size={19} />
            </button>
          </form>
          <div className="wiki-ai-footer">
            <span>{t.note}</span>
            <span>{t.status}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
