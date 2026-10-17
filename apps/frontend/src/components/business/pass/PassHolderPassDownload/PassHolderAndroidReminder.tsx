/**
 * PassHolderAndroidReminder — dedicated card reminding Android users
 * to install Passwallet before opening the .pkpass link.
 *
 * @module business/pass/PassHolderPassDownload/PassHolderAndroidReminder
 *
 * Apple Wallet is iOS-only. Android users need the Passwallet app to
 * open .pkpass files. Without this reminder, an Android user clicking
 * the CTA would see a confusing browser error (most browsers can't
 * open .pkpass). The card surfaces the icon + install CTA.
 *
 * 2026-10-19 — initial version. The `passwallet_icon.webp` is loaded
 * from `/apps/frontend/public/images/passwallet_icon.webp` — already
 * in the repo per `git status` (untracked).
 *
 * Rule 010 (UI/UX Pro Max) — icon size + minimum touch target 44pt;
 * copy is fully zh-TW / en via i18n.
 */

import { useTranslation } from 'react-i18next';

export interface PassHolderAndroidReminderProps {
  /** Optional override URL — defaults to the official Google Play listing. */
  installUrl?: string;
}

const DEFAULT_PASSWALLET_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.attidomobile.passwallet&hl=zh_TW';

export function PassHolderAndroidReminder({
  installUrl = DEFAULT_PASSWALLET_PLAY_URL,
}: PassHolderAndroidReminderProps) {
  const { t } = useTranslation('passHolder');

  return (
    <aside
      className="flex items-start gap-3 rounded-md border p-3 md:p-4"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-background)',
      }}
      data-testid="pass-holder-android-reminder"
    >
      <img
        src="/images/passwallet_icon.webp"
        alt=""
        className="h-12 w-12 shrink-0 rounded-md"
        loading="lazy"
        decoding="async"
      />
      <div className="flex flex-1 flex-col gap-1">
        <h2
          className="text-sm font-semibold"
          style={{ color: 'var(--color-foreground)' }}
        >
          {t('passwalletReminder.title')}
        </h2>
        <p
          className="text-xs md:text-sm"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          {t('passwalletReminder.body')}
        </p>
        <a
          href={installUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex h-11 min-w-[44px] items-center self-start rounded-md px-3 text-sm font-medium underline"
          style={{ color: 'var(--color-primary)' }}
          data-testid="pass-holder-passwallet-cta"
        >
          {t('passwalletReminder.installCta')}
        </a>
      </div>
    </aside>
  );
}