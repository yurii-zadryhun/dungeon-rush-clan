import React from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from './i18n';
import { initialLocale } from './locale';
import './styles.css';

// The guest page never fetches a session or private dashboard.
// Guest and member areas are separate entry chunks.
const GuestPage = React.lazy(() =>
  import('./screens/GuestPage').then((module) => ({ default: module.GuestPage })),
);
const PrivateApp = React.lazy(() =>
  import('./PrivateApp').then((module) => ({ default: module.PrivateApp })),
);
const firstLocale = initialLocale();
document.documentElement.lang = firstLocale;
const isPublicClan = /^\\/clan\\/?$/.test(location.pathname);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider initial={firstLocale}>
      <React.Suspense fallback={<div className="loading-page"><span className="spinner" /></div>}>
        {isPublicClan ? <GuestPage /> : <PrivateApp />}
      </React.Suspense>
    </LanguageProvider>
  </React.StrictMode>,
);
