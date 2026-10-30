import React from 'react';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from './i18n';
import { initialLocale } from './locale';
import './styles.css';
import './styles-dashboard.css';
import './styles-forms.css';
import './styles-layout.css';

// Public /clan pages are rendered by Nest as lightweight HTML without client JavaScript.
const PrivateApp = React.lazy(() =>
  import('./PrivateApp').then((module) => ({ default: module.PrivateApp })),
);
const firstLocale = initialLocale();
document.documentElement.lang = firstLocale;

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider initial={firstLocale}>
      <React.Suspense
        fallback={
          <div className="loading-page">
            <span className="spinner" />
          </div>
        }
      >
        <PrivateApp />
      </React.Suspense>
    </LanguageProvider>
  </React.StrictMode>,
);
