/**
 * PassHolderHeader — minimal branded header for the public "Get Pass" page.
 *
 * Visual contract (per design-system/MASTER.md §1):
 *   - Surface:   var(--color-card) on var(--color-background) page
 *   - Border:    var(--color-border) bottom 1px
 *   - Title:     var(--color-foreground), text-xl font-bold
 *   - Subtitle:  var(--color-muted-foreground), text-xs
 *   - Logo:      48×48 rounded square (issuerLogo) OR Lucide Store fallback
 *
 * No auth controls / language switcher / theme toggle (public page,
 * unauthenticated visitor).
 */

import { Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PublicPassTemplate } from '@saome/shared/types/passHolder';
import { cardTypeSchema } from '@saome/shared/schemas/card';
import { api } from '@/config/api';

/**
 * Build the `<img src>` value for the issuer logo.
 *
 * Two input shapes:
 *   - **Absolute URL** (mock-stage, e.g. `https://picsum.photos/...`):
 *     passed through as-is. No proxy needed; the browser resolves the URL
 *     directly.
 *   - **R2 key** (production-stage, e.g. `{tenant}/{template}/issuer-logo.png`):
 *     wrapped with the `/api/pass-templates/:id/logo` proxy so the backend
 *     can rebuild the key with `buildImageKey()` for multi-tenant audit
 *     (fail-closed 204 if mismatch — see
 *     runs/decisions/2026-10-01-pass-templates-public-logo-proxy.md).
 *
 * Returns null when no logo is set, signaling the consumer to render the
 * Lucide `<Store>` fallback icon.
 *
 * @param templateId   - Template UUID (used to construct the proxy URL)
 * @param issuerLogo   - The value from `template.issuerLogo` (URL or R2 key)
 * @returns            - URL string for `<img src>` or null for fallback
 */
export function buildLogoSrc(
  templateId: string,
  issuerLogo: string | undefined,
): string | null {
  if (!issuerLogo) return null;
  if (issuerLogo.startsWith('http://') || issuerLogo.startsWith('https://')) {
    return issuerLogo;
  }
  // Production R2 key — wrap with public proxy
  return `${api.baseUrl}${api.paths.passLogo(templateId)}`;
}

export interface PassHolderHeaderProps {
  template: PublicPassTemplate | null;
  className?: string;
}

const CARD_TYPE_HUMAN_LABEL: Record<string, { zh: string; en: string }> = {
  stamp_card: { zh: '印章卡', en: 'Stamp Card' },
  cashback_card: { zh: '現金回饋卡', en: 'Cashback Card' },
  reward_card: { zh: '獎勵卡', en: 'Reward Card' },
  membership_card: { zh: '會員卡', en: 'Membership Card' },
  discount_card: { zh: '折扣卡', en: 'Discount Card' },
  coupon_card: { zh: '折價券卡', en: 'Coupon Card' },
  multipass: { zh: 'MultiPass', en: 'MultiPass' },
  gift_card: { zh: '儲值卡', en: 'Gift Card' },
};

/** Localized human label for a card type. Falls back to the raw enum. */
function humanizeCardType(
  cardType: string,
  locale: string,
): string {
  const entry = CARD_TYPE_HUMAN_LABEL[cardType];
  if (!entry) return cardType;
  return locale.startsWith('zh') ? entry.zh : entry.en;
}

export function PassHolderHeader({ template, className }: PassHolderHeaderProps) {
  const { t, i18n } = useTranslation('passHolder');

  const headerStyle = {
    backgroundColor: 'var(--color-card)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-card-foreground)',
  };

  // Validate cardType before using the human-label map (defensive — schema
  // is the single source of truth). t() is called with a guaranteed string
  // because cardTypeSchema.parse either returns the literal or throws.
  let subtitle = '';
  if (template) {
    const validated = cardTypeSchema.parse(template.cardType);
    const cardTypeLabel = humanizeCardType(validated, i18n.language);
    subtitle = `${template.issuerName} · ${cardTypeLabel}`;
  }

  return (
    <header
      data-testid="pass-holder-header"
      className={`w-full border-b p-4 sm:p-6 ${className ?? ''}`}
      style={headerStyle}
    >
      <div className="mx-auto flex max-w-screen-md items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg"
          style={{
            backgroundColor: 'var(--color-muted)',
            color: 'var(--color-muted-foreground)',
          }}
          aria-hidden="true"
        >
          {template ? (
            (() => {
              const src = buildLogoSrc(template.id, template.issuerLogo);
              return src ? (
                <img
                  src={src}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <Store size={24} aria-hidden="true" />
              );
            })()
          ) : (
            <Store size={24} aria-hidden="true" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1
            className="truncate text-xl font-bold"
            style={{ color: 'var(--color-foreground)' }}
            data-testid="pass-holder-header-title"
          >
            {template?.logoText ?? t('title')}
          </h1>
          {subtitle ? (
            <p
              className="truncate text-xs"
              style={{ color: 'var(--color-muted-foreground)' }}
              data-testid="pass-holder-header-subtitle"
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}