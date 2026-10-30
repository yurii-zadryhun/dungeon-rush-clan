import React from 'react';
import { ScanLine } from 'lucide-react';
import { api } from '../api';
import { useI18n } from '../i18n';
import './OcrLimitStatus.css';

interface OcrLimit {
  limit: number;
  remaining: number;
  windowSeconds: number;
  resetAt: number | null;
}

export function OcrLimitStatus({ refreshKey = 0 }: { refreshKey?: number }) {
  const { t, locale } = useI18n();
  const [quota, setQuota] = React.useState<OcrLimit | null>(null);

  React.useEffect(() => {
    let active = true;
    void api<OcrLimit>('ocr/limit')
      .then((value) => {
        if (active) setQuota(value);
      })
      .catch(() => {
        if (active) setQuota(null);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (!quota) return null;

  const resetLabel = quota.resetAt
    ? new Intl.DateTimeFormat(locale === 'uk' ? 'uk-UA' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(quota.resetAt))
    : null;

  return (
    <div className={'ocr-limit-status' + (quota.remaining === 0 ? ' exhausted' : '')} role="status">
      <ScanLine size={15} aria-hidden="true" />
      <span>
        {t('ocrLimitRemaining', { remaining: quota.remaining, limit: quota.limit })}
        <small>
          {t('ocrLimitWindow', { minutes: quota.windowSeconds / 60 })}
          {resetLabel ? ' · ' + t('ocrLimitResets', { time: resetLabel }) : ''}
        </small>
      </span>
    </div>
  );
}
