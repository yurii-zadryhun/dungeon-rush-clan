import { Gamepad2, Send } from 'lucide-react';
import { useI18n } from '../i18n';
import './ClanSocialLinks.css';

export function ClanSocialLinks({
  telegramUrl,
  discordUrl,
}: {
  telegramUrl: string;
  discordUrl: string;
}) {
  const { t } = useI18n();
  if (!telegramUrl && !discordUrl) return null;

  return (
    <div className="clan-social-links" aria-label={t('clanLinksTitle')}>
      {telegramUrl && (
        <a
          className="clan-social-link telegram"
          href={telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('clanTelegram')}
          title={t('clanTelegram')}
        >
          <Send size={17} aria-hidden="true" />
        </a>
      )}
      {discordUrl && (
        <a
          className="clan-social-link discord"
          href={discordUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('clanDiscord')}
          title={t('clanDiscord')}
        >
          <Gamepad2 size={18} aria-hidden="true" />
        </a>
      )}
    </div>
  );
}
