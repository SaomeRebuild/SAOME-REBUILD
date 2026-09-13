/**
 * CardNameField — 卡片名稱輸入（原生 HTML）
 *
 * 2026-09-13 semantic swap (renamed from StoreNameField):
 *   - Was: storeName → settings.storeName (JSONB)
 *   - Now: cardName → templates.name (SQL column, top-level payload)
 *
 * The "Card Name" is the user-facing name used to identify a template
 * in their library (e.g. "VIP 黑卡 2026 Q4"). It is NOT shown on the
 * pass header itself — that's what Logo Text (Header input) is for.
 *
 * Persistence: on save, `cardName` is sent at the top-level payload
 * (`{ name: cardName, settings: { logoText, issuerName, issuerLogo } }`),
 * routing to the SQL column `templates.name`. The shared zod schema
 * accepts `name` at the top level of `updateTemplateSchema`.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

export function CardNameField({ showValidation }: { showValidation?: boolean }) {
  const { t } = useTranslation('cardEditor');
  const cardName = useCardBuilderStore((s) => s.cardName);
  const setCardName = useCardBuilderStore((s) => s.setCardName);
  const isEmpty = !cardName.trim();

  return (
    <div className="space-y-2">
      <label htmlFor="card-name" className="text-sm font-medium">
        {t('step2.cardName.title')}
      </label>
      <input
        id="card-name"
        type="text"
        value={cardName}
        onChange={(e) => setCardName(e.target.value)}
        placeholder={t('step2.cardName.placeholder')}
        required
        aria-describedby={showValidation && isEmpty ? 'card-name-error' : undefined}
        aria-invalid={showValidation && isEmpty ? 'true' : undefined}
        className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50
          ${showValidation && isEmpty ? 'border-destructive ring-destructive' : 'border-input'}`}
      />
      {showValidation && isEmpty && (
        <p
          id="card-name-error"
          className="flex items-center gap-1.5 text-xs"
          style={{ color: 'var(--color-destructive)' }}
          role="alert"
        >
          <span aria-hidden="true">⚠</span>
          {t('step2.cardName.required')}
        </p>
      )}
    </div>
  );
}
