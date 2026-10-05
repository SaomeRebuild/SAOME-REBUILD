/**
 * TemplateCardPreview ??璅⊥摨怠??典??閬?(per-cardType + per-card language).
 *
 * 2026-10-04 PR ???神?箄???TemplateSettings + per-cardType 皜脫?:
 *   - membership_card: ?抵????∪???/ ?之??雿輻 fieldPreview.memberName.{label,value})
 *   - stamp_card / multipass + ?征 stampIconId: 皜脫? StampGridPreview
 *   - ?嗡? cardType: CreditCard + name (legacy fallback)
 *   - Body: 霈 settings.leftField / settings.rightField 憿舐內撠? i18n label + value
 *   - Footer: BARCODE_IMAGES[settings.barcodeType ?? 'qr_code'] + holderName
 *
 * 2026-10-04 PR ??Per-card 隤頂?? (?詨? invariant):
 *   敹??萄儐 `settings.language`(per-card DB 隤頂),銝?血? app-wide `i18n.language`?? *   雿輻 `i18n.getFixedT(lng, ns)` ?踹 per-language scoped translator ?? *   銝蔣??global i18n state,摰? (Rule 023 禮 璆剖??摩 + Rule 024
 *   禮 璆剖??摩??shared/)?? *
 * ?箔?暻潔???useTranslation:敺???i18n.language 霈?銝?re-render;?? * 銝撘萄??en 隤頂?銝撘?zh-TW 隤頂??摮???芣??券頝?app-wide ??,
 * ???er-card 隤頂??瘙? *
 * 2026-10-04 PR ??Per-cardType field substitution via shared `resolveSlot`:
 *   `TemplateCardPreview` and `PassCardPreviewBody` share the same per-cardType
 *   branch tree (`./CardPreview/passCardPreviewSlot.ts`). For the library
 *   caller (this file), tier-name values are sourced from the saved-template
 *   `settings` blob via `deriveTemplateOverrides(settings)`. Membership cards
 *   now render `settings.membershipTiers[0].name` instead of the generic
 *   "??" / "Gold" placeholder. Same shape as the user's data:
 *     "cardType": "membership_card",
 *     "membershipTiers": [{"name": "?臬", ...}]
 *   ??preview value = "?臬".
 *
 * Layout ??身閮?朣?(PhoneFrame 154?210 thumbnail),stamps / membership
 * ??函? render,?嗡?憿?靽? legacy hero (CreditCard + name)?? */
import { Building2, CreditCard } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { api } from '@/config/api';
import { getAccessToken } from '@/services/authStore';
import { useCardBuilderStore } from '../CardBuilderEditor/CardBuilderEditor.store';
import { StampGridPreview } from '@/components/business/stampCard/StampGridPreview';
import type { templateSettingsSchema } from '@saome/shared/schemas/card';
import { BARCODE_IMAGES } from '@saome/shared/schemas/cardBuilder';
import { normalizeToCssColor } from '@saome/shared/logic/color';
import type { BarcodeType } from '@saome/shared/schemas/card';
import type { z } from 'zod';
// 2026-10-04 PR ??`resolveSlot` is shared with the editor-side preview
// (`PassCardPreviewBody.tsx`). The library caller (this component) passes
// values derived from the saved `settings` blob via `deriveTemplateOverrides`,
// so a membership_card renders its `settings.membershipTiers[0].name` instead
// of the generic "??" / "Gold" placeholder. Same per-cardType override
// tree, same `t` translator bound to `settings.language` for per-card
// language isolation.
//
// 2026-10-05 PR ??`resolveHeaderRightSlot` is shared with the editor-side
// header (`PassCardPreviewHeader.tsx`). The library caller passes values
// derived from the saved `settings` blob (hasExpiry/expiryDate/currency/
// discountCustomExpiryDays/etc.). This fixes the long-standing drift where
// the library preview always rendered a generic "Membership Card" pill on
// the header right side ??now it follows the SAME per-cardType branch tree
// as the editor (membership ??member expiry block, balance cards ??balance
// preview block, etc.). See user feedback:
//   "?ㄐ瘝?鋡怠?芋?輻?Header fields?踵?嚗?????芸楛?eader fields閬?"
import {
  resolveSlot,
  deriveTemplateOverrides,
  resolveHeaderRightSlot,
} from '../CardBuilderEditor/CardPreview/passCardPreviewSlot';

// Convenience alias ??the schema is the source of truth; the type is a
// thin alias so this file can use `TemplateSettings` without a Type suffix.
type TemplateSettings = z.infer<typeof templateSettingsSchema>;

// Barcode types allowed by the schema. Fallback to qr_code when settings
// is missing the field (legacy templates pre-barcodeType).
const BARCODE_FALLBACK: BarcodeType = 'qr_code';

const DEMO_BARCODE_VALUE = '4938591027384';

/** Strip width fallback (px) used by useState initial value when
 *  ResizeObserver is unavailable (e.g. jsdom). Same role as
 *  `DEFAULT_STRIP_WIDTH` in `PassCardPreviewStrip.tsx`. */
const COMPACT_STRIP_WIDTH = 200;

/** Strip height = strip width ? this ratio (maintains 1860?738 ratio,
 *  same constant as PassCardPreviewStrip.tsx STRIP_HEIGHT_RATIO = 0.32). */
const STRIP_HEIGHT_RATIO = 0.32;

interface TemplateCardPreviewProps {
  templateId?: string;
  /**
   * Legacy flat props. Optional ??when `settings` is provided, those
   * values win. Kept for backward compat with old test fixtures that
   * don't pass full settings.
   */
  name?: string;
  cardType?: TemplateSettings['cardType'];
  issuerName?: string;
  issuerLogo?: string;
  backgroundColor?: string;
  textColor?: string;
  /**
   * 2026-10-04 PR ??Full template settings. Drives per-cardType rendering
   * (membership strip / stamp grid / etc.), left/right field labels, and
   * the barcode image.
   */
  settings?: TemplateSettings;
}

export function TemplateCardPreview({
  templateId,
  name,
  cardType,
  issuerName,
  issuerLogo,
  backgroundColor = '#ffffff',
  textColor = '#000000',
  settings,
}: TemplateCardPreviewProps) {
  // Resolve final values with precedence:
  //   1. settings (preferred ??single source of truth)
  //   2. legacy props (fallback for old test fixtures / callers)
  const effectiveCardType = settings?.cardType ?? cardType ?? null;
  // 2026-10-05 fix ??header text now sourced from `logoText` (NOT issuerName).
  // Per the schema contract (`backgroundColor/Text/logoText` comment in
  // shared/schemas/card.ts), logoText is "the text shown on the pass
  // header (next to the issuer logo)". The editor-side header
  // (`PassCardPreviewHeader.tsx`) renders `name` (which IS logoText) in
  // its header. The library preview must mirror that contract ??using
  // `issuerName` in the header was a drift from the editor convention.
  // The legacy `issuerName` prop is preserved for backward compat
  // callers but no longer drives the header text.
  const effectiveName = settings?.logoText ?? name;
  const effectiveIssuerName = settings?.issuerName ?? issuerName;
  const effectiveIssuerLogo = settings?.issuerLogo ?? issuerLogo;
  const effectiveBarcodeType: BarcodeType = settings?.barcodeType ?? BARCODE_FALLBACK;
  const effectiveLeftField = settings?.leftField;
  const effectiveRightField = settings?.rightField;
  const effectiveStampGridRows = settings?.stampGridRows;
  const effectiveStampIconId = settings?.stampIconId;
  const effectiveBackgroundImageR2Key = settings?.backgroundImage;

  // 2026-10-05 PR ??Mirror `effectiveBackgroundColor` for textColor.
  // Previous implementation only read `textColor` from the prop default
  // (`#000000`), so `settings.textColor` was silently ignored ??the user
  // would set a custom color in the editor and the library preview would
  // show hardcoded `text-neutral-950` / `text-neutral-500` / `text-neutral-900`
  // Tailwind classes that ALWAYS win over inherited / inline color. With
  // `effectiveTextColor`, settings wins (same precedence rule as background:
  // settings first, legacy prop fallback, empty string falls through to
  // default via `||`).
  //
  // 2026-10-05 PR extension ??Both `effectiveBackgroundColor` and
  // `effectiveTextColor` MUST run through `normalizeToCssColor` before
  // being placed into inline style. The editor
  // (`CardBuilderEditorWorkspace.tsx`) intentionally stores these values
  // in PassCreator contract format: 6-char uppercase hex WITHOUT the
  // leading `#` (e.g. `backgroundColor.replace('#', '').toUpperCase()`).
  // A bare `FFFFFF` in `background-color: FFFFFF` is invalid CSS ??the
  // browser discards the whole declaration, the inner surface falls
  // back to the outer phone-frame `bg-white` Tailwind class, and the
  // user sees a white card regardless of what color they actually saved
  // (this is the regression the user reported as "?孵?蝝怨雿??舐??).
  // `normalizeToCssColor` guarantees the inline style always carries a
  // CSS-valid `#RRGGBB`, regardless of whether the value came from DB
  // (stripped) or a prop (already-prefixed).
  const effectiveBackgroundColor = normalizeToCssColor(
    settings?.backgroundColor,
    backgroundColor,
  );
  const effectiveTextColor = normalizeToCssColor(
    settings?.textColor,
    textColor,
  );

  // 2026-10-04 PR ??Per-card language isolation. The translator is
  // bound to settings.language (or app default zh-TW) and is NOT
  // subscribed to i18n.language changes ??a single render scoped to a
  // single card language. This lets multiple cards of different
  // languages coexist on the same page without cross-talk.
  const lng = settings?.language ?? 'zh-TW';
  const tPassCard = useMemo(
    () => i18n.getFixedT(lng, 'passCard'),
    [lng],
  );
  const tCardEditor = useMemo(
    () => i18n.getFixedT(lng, 'cardEditor'),
    [lng],
  );

  // Keep the useTranslation hook to satisfy component-library lint rules
  // that expect every component to have at least one i18n binding. The
  // returned `t` is intentionally unused ??the per-card translators
  // above are the only authoritative i18n source for this render.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { t: _globalT } = useTranslation('passCard');

  // 2026-10-05 PR ??Strip height now uses proportional paddingBottom 32%
  // (matching `PassCardPreviewStrip` 1860?738 ratio), not `h-[100px]` (fixed
  // pixel). Measure the strip container width live via ResizeObserver so the
  // stamp grid scales correctly across card widths. When ResizeObserver is
  // unavailable (e.g. jsdom test), useState initial value falls back to
  // `COMPACT_STRIP_WIDTH = 200` (same role as `DEFAULT_STRIP_WIDTH` in
  // `PassCardPreviewStrip.tsx`).
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [stripWidth, setStripWidth] = useState<number>(COMPACT_STRIP_WIDTH);
  useLayoutEffect(() => {
    const node = stripRef.current;
    if (!node) return;
    const update = () => {
      const measured = node.getBoundingClientRect().width;
      if (measured > 0) setStripWidth(measured);
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const stripHeight = stripWidth * STRIP_HEIGHT_RATIO;

  // Build proxy URL for issuer logo (cache-bust via issuerLogoVersion).
  const token = getAccessToken();
  const issuerLogoVersion = useCardBuilderStore.getState().issuerLogoVersion;
  const logoUrl = effectiveIssuerLogo && templateId
    ? `${api.baseUrl}${api.paths.cardImage(templateId, 'logo')}${token ? `?token=${encodeURIComponent(token)}` : ''}&v=${issuerLogoVersion}`
    : undefined;

  // 2026-10-05 fix ??Background image proxy URL. The strip area is the
  // canonical Apple Wallet location for a hero image (the same place
  // real Wallet passes put a hero/cover photo). `settings.backgroundImage`
  // is an R2 key (`{tenantId}/{templateId}/background.png`) per the
  // schema contract. We resolve through the same `cardImage` endpoint
  // used by `issuerLogo`, just with the `'background'` variant ??this
  // keeps auth consistent (auth-bound GET) and avoids leaking R2 keys
  // to the browser. The empty string / undefined / missing-templateId
  // cases all resolve to `undefined` so the strip does NOT render a
  // broken `url("")` reference.
  const backgroundImageUrl = effectiveBackgroundImageR2Key && templateId
    ? `${api.baseUrl}${api.paths.cardImage(templateId, 'background')}${token ? `?token=${encodeURIComponent(token)}` : ''}`
    : undefined;

  // Membership card strip: two lines (label / value)??  // Reads passCard.fieldPreview.memberName.{label, value} via per-language t().
  const membershipStripLabel = tPassCard('fieldPreview.memberName.label');
  const membershipStripValue = tPassCard('fieldPreview.memberName.value');

  // Should we render the stamp grid? PassCardPreviewStrip's gating
  // condition (stamp_card | multipass + non-empty stampIconId).
  const isStampCard =
    (effectiveCardType === 'stamp_card' || effectiveCardType === 'multipass') &&
    Boolean(effectiveStampIconId);

  // Barcode image src ??pick from BARCODE_IMAGES based on barcodeType.
  const barcodeImage = BARCODE_IMAGES[effectiveBarcodeType];

  // 2026-10-04 PR ??Currency code surfaced for testability + future use.
  // Per user spec 2026-10-04: ZAR amounts render as "R10" (R prefix, amount
  // after); TWD amounts render as "10?? (amount before, ??suffix).
  // The current `TemplateCardPreview` body shows static i18n demo values
  // (e.g. "5 甈?, "23 暺?, "hi@saome.org") which are currency-neutral,
  // so the formatter is NOT applied inline here. The `data-currency`
  // attribute is exposed so future code (e.g. cashback tier preview,
  // balance preview) can branch on the currency without re-reading
  // settings. The full ZAR/TWD formatter lives in
  // `packages/shared/logic/cashbackPreviewAmounts.ts` /
  // `discountPreviewAmounts.ts` ??mirror that pattern when adding
  // amount-bearing fields to this component.
  const effectiveCurrency = settings?.currency ?? 'TWD';

  // Card-type pill label (raw enum ??translated).
  // 2026-10-05: kept for the FALLBACK pill branch (null / undefined
  // cardType). When `effectiveCardType` is non-null, the header right slot
  // is REPLACED by the per-cardType preview block via
  // `resolveHeaderRightSlot` below ??the pill is no longer shown.
  const cardTypePillLabel = effectiveCardType
    ? tCardEditor(`step1.cardTypes.${effectiveCardType}`)
    : tPassCard('defaultCardType');

  // 2026-10-05 PR ??Per-cardType header right slot.
  // The right side of the header used to be a static "Membership Card" /
  // "Stamp Card" pill regardless of cardType. Now it follows the SAME
  // branch tree as the editor (`PassCardPreviewHeader.tsx`):
  //   - membership_card    ??member expiry preview  (label "??唳??? / "??)
  //   - discount_card      ??discount expiry preview  (label "????")
  //   - coupon_card        ??coupon expiry preview    (label "????")
  //   - stamp_card / reward_card / cashback_card / multipass
  //                          ??balance preview          (label "擗?")
  //   - gift_card          ??gift points preview      (label "暺" / "2363暺?)
  //   - null / undefined   ??default pill (t('defaultCardType'))
  //
  // Values are sourced from the saved `settings` blob (NOT from the editor
  // store ??library previews are read-only). The `resolveHeaderRightSlot`
  // helper accepts a flat inputs bag so both editor and library can call
  // it without coupling to either data source.
  const headerRightSlot = resolveHeaderRightSlot(tPassCard, {
    cardType: effectiveCardType,
    // Membership expiry source: settings.hasExpiry + settings.expiryDate
    hasExpiry: settings?.hasExpiry,
    expiryDate: settings?.expiryDate,
    // Discount expiry source: Step 6-specific fields
    discountCustomExpiryDays: settings?.discountCustomExpiryDays ?? null,
    discountSpecificExpiryDate: settings?.discountSpecificExpiryDate ?? null,
    // Coupon expiry source: Step 2 card-level fields
    passValidDays: settings?.passValidDays ?? null,
    // Balance preview source: settings.currency
    currency: effectiveCurrency,
    // Locale for date formatting
    locale: lng,
  });

  // Display values for body fields.
  // 2026-10-04 PR ??Delegate per-cardType field substitution to the shared
  // `resolveSlot` helper so TemplateCardPreview uses the SAME logic as the
  // editor-side PassCardPreviewBody. The library caller sources tier-name
  // overrides from `settings.*` (not the editor store) via
  // `deriveTemplateOverrides(settings)`. This is the root-cause fix for
  // the user's report that the 2nd card preview showed the abandoned
  // row's `settings: { locationsDisabled: false }` placeholder values ??  // now the library preview renders the first tier name, currency-driven
  // amount fields, etc., exactly like the editor preview.
  //
  // 2026-10-04 fix ??right slot must use its OWN label fallback
  // ("?單?雿?) not the left-slot fallback ("撌行?雿?). The previous code
  // called `resolveLeftLabel` for both slots, so a null rightField
  // rendered "撌行?雿? on the right column (copy-paste bug).
  const overrides = deriveTemplateOverrides(settings);
  const leftPreview = resolveSlot(tPassCard, {
    field: effectiveLeftField ?? null,
    stampGridRows: effectiveStampGridRows,
    cardType: effectiveCardType,
    currency: effectiveCurrency,
    ...overrides,
  });
  const rightPreview = resolveSlot(tPassCard, {
    field: effectiveRightField ?? null,
    stampGridRows: effectiveStampGridRows,
    cardType: effectiveCardType,
    currency: effectiveCurrency,
    ...overrides,
  });
  const leftFieldLabel = leftPreview.label;
  const leftFieldValue = leftPreview.value;
  const rightFieldLabel = rightPreview.label;
  const rightFieldValue = rightPreview.value;

  return (
    <div
      data-testid="template-card-preview"
      data-card-type={effectiveCardType ?? 'unknown'}
      data-language={lng}
      data-currency={effectiveCurrency}
      className="relative flex w-full overflow-hidden rounded-[12px] border border-transparent bg-white shadow-[0_4px_16px_rgba(0,0,0,0.15)]"
      style={{ aspectRatio: '375 / 600' }}
    >
      {/* 2026-10-05 PR ??Inner card surface uses the user-configured
          `backgroundColor` (settings.backgroundColor or legacy prop),
          NOT the hardcoded `bg-white` from the previous implementation.
          The outer div keeps `bg-white` because it represents the phone-frame
          shadow / border area (visible only at the rounded corners); the
          inner div is the actual card surface that should match the user's
          template color. Background and text color flow through to the
          strip below (which already had its own `backgroundColor` style) for
          visual continuity.

          2026-10-05 PR extension ??`effectiveBackgroundColor` reads from
          settings.backgroundColor first (single source of truth) with the
          legacy prop as fallback. This fixes the bug where
          `CardBuilderPage.tsx`'s dto?ata mapping dropped the legacy
          `backgroundColor` prop, leaving the preview stuck at the default
          `#ffffff` regardless of what the user actually saved. */}
      <div
        className="relative flex h-full w-full flex-col"
        style={{ backgroundColor: effectiveBackgroundColor, color: effectiveTextColor }}
      >
        {/* Header ????銝撠挾 */}
        <div className="flex items-center justify-between px-2 pt-0.5">
          <div className="flex items-center gap-1">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={effectiveIssuerName ?? tPassCard('defaultIssuerName')}
                className="h-4 w-4"
                style={{ borderRadius: 'inherit', objectFit: 'contain' }}
              />
            ) : (
              <Building2 size={12} className="text-neutral-400" aria-hidden="true" />
            )}
            {/* 2026-10-05 fix ??header text now sourced from logoText
                (effectiveName = settings?.logoText ?? name), per the
                schema contract "logoText ??the text shown on the pass
                header (next to the issuer logo)". Previously this span
                used effectiveIssuerName, which was inconsistent with
                the editor preview's PassCardPreviewHeader.tsx (which
                renders the logoText `name` prop in its header). */}
            <span
              className="text-[10px] font-bold leading-tight"
              style={effectiveTextColor ? { color: effectiveTextColor } : undefined}
            >
              {effectiveName ?? tPassCard('defaultIssuerName')}
            </span>
          </div>
          {headerRightSlot.kind === 'preview' ? (
            // 2026-10-05 PR ??Per-cardType 2-line preview block (member
            // expiry / discount expiry / coupon expiry / balance / gift
            // points). Mirrors `PassCardPreviewHeader.tsx` layout: flex
            // flex-col items-start gap-0.5 (label above value, both
            // left-aligned). Typography matches the compact thumbnail
            // (label 8px font-medium / value 11px font-bold).
            <div
              data-testid={headerRightSlot.testId}
              className="flex flex-col items-start gap-0 leading-tight"
            >
              <span
                className="text-[8px] font-medium"
                style={effectiveTextColor ? { color: effectiveTextColor } : undefined}
              >
                {headerRightSlot.label}
              </span>
              <span
                className="text-[11px] font-bold"
                style={effectiveTextColor ? { color: effectiveTextColor } : undefined}
              >
                {headerRightSlot.value}
              </span>
            </div>
          ) : (
            // Fallback pill ??only rendered when cardType is null / undefined.
            // 2026-10-05: kept the same shape (rounded-full px-1.5 py-0.5
            // text-[8px] font-medium leading-none) as the original
            // implementation so existing test selectors keep working.
            <span
              data-testid="card-type-pill"
              className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[8px] font-medium leading-none"
              style={effectiveTextColor ? { color: effectiveTextColor } : undefined}
            >
              {cardTypePillLabel}
            </span>
          )}
        </div>

        {/* Strip / Hero ??per-cardType ? */}
        {/* 2026-10-05 PR ??Membership cards use left-aligned layout
            (items-start / text-left). Other card types keep the centered
            layout (items-center / text-center) to match the existing
            hero treatment. The membership branch shows the member's
            name + tier-name as the visual focal point ??left-aligned
            layout matches the `CardPreviewBody` left-column style and
            reads more naturally for member info (Apple Wallet pattern).

            2026-10-05 PR (UI alignment) ??strip height now driven by
            `paddingBottom: '32%'` (proportional, matches CardBuilder's
            `PassCardPreviewStrip` 1860?738 ratio) instead of fixed
            `h-[100px]`. The strip container uses `relative + overflow-hidden`
            and the inner content layer is positioned with
            `absolute inset-0` so it fills the padding-allocated space.
            Background image / color are still applied on the container. */}
        <div
          ref={stripRef}
          data-strip-width={stripWidth}
          className={
            effectiveCardType === 'membership_card'
              ? 'relative mx-0 mt-2 overflow-hidden text-left'
              : 'relative mx-0 mt-2 overflow-hidden text-center'
          }
          style={{
            backgroundColor: effectiveBackgroundColor,
            color: effectiveTextColor,
            paddingBottom: '32%',
            // 2026-10-05 fix ??surface `settings.backgroundImage` on the
            // strip (Apple Wallet's canonical hero-image location). The
            // URL is the proxied cardImage endpoint, mirroring how
            // `issuerLogo` is rendered above. backgroundSize='cover' +
            // backgroundPosition='center' so the image fills the strip
            // regardless of aspect ratio. Empty/undefined ??no property
            // applied (avoids invalid CSS `url("")` references).
            ...(backgroundImageUrl
              ? {
                  backgroundImage: `url(${backgroundImageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : {}),
          }}
        >
          {/* 2026-10-05 PR (UI alignment) ??inner content layer uses
              `absolute inset-0` to fill the container's padding-allocated
              space. Matches `PassCardPreviewStrip.tsx` content pattern so
              the two previews share identical proportional behavior across
              thumb widths. */}
          <div className="absolute inset-0 flex items-start justify-start" style={{ padding: 4 }}>
            {effectiveCardType === 'membership_card' ? (
              // 2026-10-05 fix: left-aligned vertical stack (items-start gap-2),
              // matching `PassCardPreviewStrip.tsx` membership strip layout
              // (label on top, value below, left-aligned).
              <div className="flex flex-col items-start gap-2">
                <span className="text-[9px] font-medium leading-tight" style={{ color: effectiveTextColor }}>
                  {membershipStripLabel}
                </span>
                <span className="text-[10px] font-semibold leading-tight" style={{ color: effectiveTextColor }}>
                  {membershipStripValue}
                </span>
              </div>
            ) : isStampCard ? (
              <StampGridPreview
                iconId={effectiveStampIconId!}
                rows={effectiveStampGridRows ?? 1}
                stripHeight={stripHeight}
                stripWidth={stripWidth}
                stampedCount={3}
              />
            ) : (
              <>
                <CreditCard className="h-5 w-5" style={{ color: effectiveTextColor }} aria-hidden="true" />
                <span className="text-[10px] font-semibold leading-tight" style={{ color: effectiveTextColor }}>
                  {effectiveName ?? tPassCard('defaultName')}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Body ??2-column layout mirroring PassCardPreviewBody.
            Left column = [label, value], right column = [label, value].
            Matches Apple Wallet's secondary-field pattern; matches
            PassCardPreviewBody 1:1 (label small / value larger + font-medium).
            The previous version (2026-10-04) used a 2-row layout with
            label/value SWAPPED between rows ??`rightFieldValue` rendered
            next to `leftFieldLabel`, etc. That was wrong on two axes:
              1. label/value pairs must be vertically stacked (one column),
                 not interleaved (label-then-value horizontally).
              2. label of slot X must be next to value of slot X, not slot Y.
            This rewrite uses the same `flex-row` + per-column `flex-col`
            structure as PassCardPreviewBody so the two previews are
            visually consistent. */}
        <div className="mt-2 flex flex-1 flex-col gap-1 px-2 pb-1">
          <div className="flex flex-row items-start justify-between gap-3 py-0.5">
            {/* Left column: [label, value] stacked vertically */}
            <div
              data-testid="body-left"
              className="flex min-w-0 flex-1 flex-col gap-0.5"
            >
              <span
                data-testid="body-left-label"
                className="text-[8px]"
                style={effectiveTextColor ? { color: effectiveTextColor } : undefined}
              >
                {leftFieldLabel}
              </span>
              <span
                data-testid="body-left-value"
                className="text-[10px] font-medium truncate"
                style={effectiveTextColor ? { color: effectiveTextColor } : undefined}
              >
                {leftFieldValue}
              </span>
            </div>
            {/* Right column: [label, value] stacked vertically.
                Membership card uses left-aligned layout (items-start) so
                both left + right columns visually align to the left edge
                (per user feedback 2026-10-05: "??⊥??銝????嗅???                ?椰撠?"). Other card types keep the original right-aligned
                layout (items-end) ??matches PassCardPreviewBody 1:1. */}
            <div
              data-testid="body-right"
              className="flex min-w-0 flex-1 flex-col items-end gap-0.5"
            >
              <span
                data-testid="body-right-label"
                className="text-[8px]"
                style={effectiveTextColor ? { color: effectiveTextColor } : undefined}
              >
                {rightFieldLabel}
              </span>
              <span
                data-testid="body-right-value"
                className="text-[10px] font-medium truncate"
                style={effectiveTextColor ? { color: effectiveTextColor } : undefined}
              >
                {rightFieldValue}
              </span>
            </div>
          </div>
        </div>

        {/* Footer / Barcode ??雿輻 BARCODE_IMAGES (per shared/schemas/cardBuilder) */}
        <div className="mt-auto flex flex-1 flex-col items-center justify-end border-t border-transparent p-1.5 pb-3">
          {/* 2026-10-05 PR (UI alignment) ??wrap barcode img in a white-bg
              container (border-transparent + bg-white + p-1). Mirrors
              `PassCardPreviewFooter.tsx` so the two previews share the
              same QR code presentation (camera must read QR against white
              background even when card surface is dark). The transparent
              border preserves layout box (matches `PassCardPreviewFooter`'s
              defense-in-depth pattern from the 2026-09-10 蝚砍甈∩耨甇?.

              2026-10-05 PR extension ??Per user feedback: PDF-417 is
              rendered WITHOUT a white-bg wrapper (PDF-417 is opaque
              barcode, does not need contrast against card surface).
              Only QR code gets the white-bg container. Mirrors
              `PassCardPreviewFooter.tsx`'s `isPdf417 ? <img> : <div bg-white>`
              branch exactly. The two branches are also dimensioned
              differently: QR code is square (h-9 w-9) to match the
              compact 1:1 ratio; PDF-417 is wide (h-24 w-[160px]) to
              match the real PassCreator PDF-417 strip aspect ratio. */}
          {effectiveBarcodeType === 'pdf_417' ? (
            // PDF-417: render directly without white background (PDF-417 is opaque, no contrast issue)
            <img
              src={barcodeImage}
              alt="PDF417"
              className="h-24 w-[160px] object-contain"
            />
          ) : (
            // QR code: white background container (transparent QR needs contrast for camera)
            <div className="flex items-center justify-center border border-transparent bg-white p-1">
              <img
                src={barcodeImage}
                alt="QR Code"
                className="h-9 w-9 object-contain"
              />
            </div>
          )}
          <span
            className="truncate max-w-full text-[8px]"
            style={effectiveTextColor ? { color: effectiveTextColor } : undefined}
          >
            {settings?.holderName ?? DEMO_BARCODE_VALUE}
          </span>
        </div>
      </div>
    </div>
  );
}
