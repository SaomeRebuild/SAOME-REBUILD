/**
 * CardBuilderEditorWorkspace — 左欄位：操作區
 * 根據 step 顯示不同的操作面板內容
 */

import { type HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CardType, EditorStep } from './CardBuilderEditor.types';
import { CardTypeSelector } from './CardTypeSelector';
import { Step2CardSettings } from './Step2CardSettings';
import { MediaAssetUploader } from './MediaAssetUploader';
import { Step3CardColors } from './Step3CardColors';
import { Step3CardFields } from './Step3CardFields';
import { Step3StampGrid } from './Step3StampGrid';
import { Step4CardInfo } from './Step4CardInfo';
import { Step5CardLocation } from './Step5CardLocation';
import { Step6CardLogic } from './Step6CardLogic';
import { useCardBuilderStore } from './CardBuilderEditor.store';
import {
  DESCRIPTION_MAX_LENGTH,
  BACK_FIELDS_MIN,
} from '@saome/shared/constants/card-back-fields';

interface CardBuilderEditorWorkspaceProps extends HTMLAttributes<HTMLDivElement> {
  step: EditorStep;
  onStepChange: (step: EditorStep) => void;
  cardType?: CardType | null;
  cardId?: string | null;
  onCardTypeChange: (type: CardType) => void;
  onSave?: (cardId: string, settings: Record<string, unknown>) => Promise<void>;
  onBack?: () => void;
}

export function CardBuilderEditorWorkspace({
  step,
  onStepChange,
  cardType,
  cardId,
  onCardTypeChange,
  onSave,
  onBack,
  className,
  ...rest
}: CardBuilderEditorWorkspaceProps) {
  const { t } = useTranslation('cardEditor');

  /** Step 2: Read values from Zustand store (source of truth) */
  function getStep2Values() {
    const store = useCardBuilderStore.getState();
    return {
      // 2026-09-13 semantic swap: storeName (settings.storeName, JSONB) is
      // now `cardName` (templates.name, SQL column, top-level payload).
      cardName: store.cardName,
      logoText: store.logoText,
      issuerName: store.issuerName,
    };
  }

  /**
   * Load existing template settings when cardId is provided (edit mode)
   *
   * Removed 2026-09-05 (修 2 of three-fix plan): the outer
   * CardBuilderEditor's useEffect already calls cardService.getById and
   * loadSettings on mount. Keeping this duplicate fetch caused
   * `loadSettings` to run TWICE on mount, which interplayed badly with
   * the Step 4 autosave baseline-seeding logic (see
   * DEV/09-2026/0905-step4-autosave-slow-network-baseline.md).
   *
   * cardType sync is handled by the outer effect via setCardType:
   *   if (template.cardType) setCardType(template.cardType)
   * If a parent component passes a cardType prop that diverges from the
   * store, it owns that flow (CardTypeSelector writes through directly).
   *
   * `useEffect` is still imported for any future workspace-local effects.
   */

  function isStep2Valid() {
    // 2026-09-13 swap: Block on Card Name (`cardName`) AND Logo Text
    // (`logoText`) — both are required for the user to advance past
    // Step 2 cleanly. `issuerName` is still required too.
    //   - Card Name = record name (SQL column). Mandatory so the template
    //     shows up labeled in the user's library.
    //   - Logo Text = pass header text (JSONB). Mandatory so the previewed
    //     pass has visible identity.
    //   - Issuer Name = `issuerName` from settings (unchanged).
    const { cardName, logoText, issuerName } = getStep2Values();
    return Boolean(cardName.trim() && logoText.trim() && issuerName.trim());
  }

  /**
   * Step 4 validation (Rule 019 + Apple EULA 2026-09-04):
   *   - `description` is required and ≤ DESCRIPTION_MAX_LENGTH.
   *   - `backFields` must contain ≥ BACK_FIELDS_MIN rows, every value non-empty.
   *   - `links` is OPTIONAL — invalid format does NOT block "Next". The
   *     LinkRow still shows the destructive border + i18n error inline so
   *     the user can spot the issue and fix it without losing progress.
   *
   * 2026-09-13 membership_card bypass: when `cardType === 'membership_card'`,
   * BackFieldsField is hidden (see plan `membership_card_conditional_ui_hide`).
   * The default `backFields` row is `[{ label: '', value: '' }]`, which would
   * otherwise fail validation and trap the user on Step 4. Skip the
   * backFields check entirely for membership_card — only `description`
   * must be valid. The mirror lives in `Step4CardInfo/Step4CardInfo.tsx`,
   * which gates the JSX render of `<BackFieldsField />` on the same flag.
   */
  function isStep4Valid() {
    const cardTypeValue = useCardBuilderStore.getState().cardType;
    const { description, backFields } = useCardBuilderStore.getState();
    const descriptionOk =
      description.trim().length > 0 &&
      description.length <= DESCRIPTION_MAX_LENGTH;
    if (cardTypeValue === 'membership_card') {
      return descriptionOk;
    }
    return (
      descriptionOk &&
      backFields.length >= BACK_FIELDS_MIN &&
      backFields.every((f) => f.value.trim().length > 0)
    );
  }

  /**
   * Step 5 validation (Rule 019 + 2026-09-06 refactor):
   *   - `locationsDisabled=true` → always valid (toggle off lets the user
   *     skip the whole step; the store already cleared `locations` and
   *     `locationsMaxDistance` via the setter).
   *   - `locationsDisabled=false` (toggle on, geolocation enabled) → must
   *     satisfy: ≥ 1 location row + every row has name+lat+lng + valid
   *     `locationsMaxDistance` in [100, 1000].
   */
  function isStep5Valid(): boolean {
    const {
      locationsDisabled,
      locations,
      locationsMaxDistance,
    } = useCardBuilderStore.getState();

    if (locationsDisabled) return true;

    if (locations.length === 0) return false;

    if (
      locationsMaxDistance === null ||
      !Number.isInteger(locationsMaxDistance) ||
      locationsMaxDistance < 100 ||
      locationsMaxDistance > 1000
    ) {
      return false;
    }

    return locations.every(
      (loc) =>
        loc.name.trim().length > 0 &&
        Number.isFinite(loc.latitude) &&
        Number.isFinite(loc.longitude) &&
        loc.latitude >= -90 &&
        loc.latitude <= 90 &&
        loc.longitude >= -180 &&
        loc.longitude <= 180,
    );
  }

  /**
   * Step 6 validation (Rule 019):
   *   - Non stamp_card / multipass / reward_card / cashback_card / membership_card
   *     → always valid (ComingSoon, no fields).
   *   - stamp_card / multipass → all 4 reward fields required:
   *       stampAccrualMode !== null
   *       rewardName.trim().length > 0
   *       rewardType !== null
   *       rewardValue !== null && rewardValue > 0
   *       percent_off → maxDiscountAmount is optional (null = no cap)
   *   - Accrual thresholds (2026-09-07):
   *       per_visit → stampsPerVisitCount > 0 && stampsPerVisitStamps > 0
   *       per_spend → stampsPerSpendAmount > 0 && stampsPerSpendStamps > 0
   *       per_stamp → no threshold fields required
   *
   *   - reward_card (2026-09-09 mixed refactor):
   *       earningMode !== null  (card-wide)
   *       based_on_visits    → all tiers have pointsPerVisit ≥ 1
   *       based_on_spending  → all tiers have pointsPerSpendAmount > 0
   *                            AND all tiers have pointsPerSpendPoints ≥ 1
   *       based_on_points    → no per-tier points fields required
   *       rewardTiers.length ≥ 1 with each tier identity complete
   *         (name.trim() !== '' && threshold > 0 && rewardType !== null
   *          && rewardValue > 0)
   *
   *   - cashback_card (2026-09-11):
   *       cashbackTiers.length ≥ 1
   *       each tier: name.trim() !== ''
   *               && 0 ≤ thresholdSpend ≤ CASHBACK_THRESHOLD_MAX
   *               && 1 ≤ cashbackPercent ≤ 100
   *
   *   - membership_card (2026-09-13):
   *       isPaid === false    → always valid (free membership card, no fields).
   *       isPaid === true     → membershipTiers.length ≥ 1
   *                              each tier: name.trim() !== ''
   *                              when hasExpiry=true:
   *                                  durationType !== null
   *                                  if monthly: monthlyCost >= 0 (and not null)
   *                                  if yearly:  yearlyCost >= 0 (and not null)
   */
  function isStep6Valid(): boolean {
    const cardTypeValue = useCardBuilderStore.getState().cardType;
    if (
      cardTypeValue !== 'stamp_card' &&
      cardTypeValue !== 'multipass' &&
      cardTypeValue !== 'reward_card' &&
      cardTypeValue !== 'cashback_card' &&
      cardTypeValue !== 'membership_card'
    ) {
      return true;
    }
    if (cardTypeValue === 'reward_card') {
      return isRewardStep6Valid();
    }
    if (cardTypeValue === 'cashback_card') {
      return isCashbackStep6Valid();
    }
    if (cardTypeValue === 'membership_card') {
      return isMembershipStep6Valid();
    }
    // stamp_card / multipass path
    const {
      stampAccrualMode,
      rewardName,
      rewardType,
      rewardValue,
      stampsPerVisitCount,
      stampsPerVisitStamps,
      stampsPerSpendAmount,
      stampsPerSpendStamps,
    } = useCardBuilderStore.getState();

    const baseRewardValid =
      stampAccrualMode !== null &&
      rewardName.trim().length > 0 &&
      rewardType !== null &&
      rewardValue !== null &&
      rewardValue > 0;

    if (stampAccrualMode === 'per_visit') {
      return (
        baseRewardValid &&
        stampsPerVisitCount !== null &&
        stampsPerVisitCount > 0 &&
        stampsPerVisitStamps !== null &&
        stampsPerVisitStamps > 0
      );
    }
    if (stampAccrualMode === 'per_spend') {
      return (
        baseRewardValid &&
        stampsPerSpendAmount !== null &&
        stampsPerSpendAmount > 0 &&
        stampsPerSpendStamps !== null &&
        stampsPerSpendStamps > 0
      );
    }
    // per_stamp — no threshold fields
    return baseRewardValid;
  }

  /**
   * MEMBERSHIP 卡 Step 6 validation (2026-09-13).
   *
   * Mirrors packages/shared/constants/membership-card.ts bounds:
   *   - isPaid === false    → always valid (免費會員卡，無需 Step 6 設定)
   *   - isPaid === true     → membershipTiers.length ≥ 1
   *                              each tier: name.trim() !== ''
   *                              when hasExpiry=true:
   *                                  durationType !== null
   *                                  if monthly: monthlyCost ∈ [COST_MIN, COST_MAX]
   *                                  if yearly:  yearlyCost  ∈ [COST_MIN, COST_MAX]
   *                              (cost = 0 is allowed = free membership tier.)
   *
   * 會員獎勵 sub-rows are NOT validated by Step 6 — they're optional content
   * that always renders, regardless of validity.
   */
  function isMembershipStep6Valid(): boolean {
    const { isPaid, hasExpiry, membershipTiers } = useCardBuilderStore.getState();

    // Free membership card → no Step 6 fields required.
    if (!isPaid) return true;

    if (!membershipTiers || membershipTiers.length === 0) return false;

    return membershipTiers.every((tier) => {
      // Tier identity: name required.
      if (tier.name.trim() === '') return false;
      // When hasExpiry=true: durationType + corresponding cost must be set.
      if (hasExpiry) {
        if (tier.durationType === null) return false;
        if (tier.durationType === 'monthly') {
          if (tier.monthlyCost === null || tier.monthlyCost < 0) return false;
        }
        if (tier.durationType === 'yearly') {
          if (tier.yearlyCost === null || tier.yearlyCost < 0) return false;
        }
      }
      return true;
    });
  }

  /**
   * REWARD 卡 Step 6 validation (2026-09-09 mixed refactor).
   *
   * earningMode is CARD-WIDE; per-tier earn rate fields are PER-TIER.
   * Validation walks each tier's identity AND verifies that per-tier earn
   * rate fields are consistent with the card-wide earningMode:
   *   - card-wide earningMode !== null
   *   - rewardTiers.length ≥ 1
   *   - each tier identity complete (name + threshold + rewardType + rewardValue)
   *   - based_on_visits    → each tier's pointsPerVisit ≥ 1
   *   - based_on_spending  → each tier's pointsPerSpendAmount > 0
   *                          AND each tier's pointsPerSpendPoints ≥ 1
   *   - based_on_points    → no per-tier points fields required
   */
  function isRewardStep6Valid(): boolean {
    const { earningMode, rewardTiers } = useCardBuilderStore.getState();

    // Card-wide earning mode must be selected.
    if (earningMode === null || earningMode === undefined) return false;
    if (!rewardTiers || rewardTiers.length === 0) return false;

    return rewardTiers.every((tier) => {
      // Tier identity
      if (
        tier.name.trim() === '' ||
        tier.threshold <= 0 ||
        tier.rewardType === null ||
        tier.rewardType === undefined ||
        tier.rewardValue === null ||
        tier.rewardValue === undefined ||
        tier.rewardValue <= 0
      ) {
        return false;
      }
      // Per-tier earn rate fields (conditional on card-wide earningMode).
      if (earningMode === 'based_on_visits') {
        if (
          tier.pointsPerVisit === null ||
          tier.pointsPerVisit === undefined ||
          tier.pointsPerVisit < 1
        ) {
          return false;
        }
      }
      if (earningMode === 'based_on_spending') {
        if (
          tier.pointsPerSpendAmount === null ||
          tier.pointsPerSpendAmount === undefined ||
          tier.pointsPerSpendAmount <= 0
        ) {
          return false;
        }
        if (
          tier.pointsPerSpendPoints === null ||
          tier.pointsPerSpendPoints === undefined ||
          tier.pointsPerSpendPoints < 1
        ) {
          return false;
        }
      }
      // based_on_points: no extra per-tier checks needed.
      return true;
    });
  }

  /**
   * CASHBACK 卡 Step 6 validation (2026-09-11).
   *
   * Mirrors packages/shared/constants/cashback-card.ts bounds:
   *   - cashbackTiers.length ≥ 1
   *   - each tier: name.trim() !== ''
   *           && 0 ≤ thresholdSpend ≤ CASHBACK_THRESHOLD_MAX (=999_999_999)
   *           && 1 ≤ cashbackPercent ≤ 100 (integer)
   *
   * thresholdSpend = 0 is a LEGITIMATE value (default tier, everyone
   * qualifies). Validation only checks the upper bound.
   */
  function isCashbackStep6Valid(): boolean {
    const { cashbackTiers } = useCardBuilderStore.getState();

    if (!cashbackTiers || cashbackTiers.length === 0) return false;

    return cashbackTiers.every((tier) => {
      if (tier.name.trim() === '') return false;
      if (tier.thresholdSpend < 0 || tier.thresholdSpend > 999_999_999) return false;
      if (tier.cashbackPercent < 1 || tier.cashbackPercent > 100) return false;
      // cashbackPercent must be an integer.
      if (!Number.isInteger(tier.cashbackPercent)) return false;
      return true;
    });
  }

  async function handleNext() {
    console.log('[handleNext] step:', step, 'cardId:', cardId);
    if (step < 8) {
      if (step === 2 && !isStep2Valid()) return;
      if (step === 4 && !isStep4Valid()) return;
      if (step === 5 && !isStep5Valid()) return;
      if (step === 6 && !isStep6Valid()) return;
      if (step === 2 && cardId && onSave) {
        try {
          // 2026-09-13 semantic swap: cardName goes to SQL column
          // `templates.name` (top-level payload); logoText goes to
          // `settings.logoText` (JSONB). storeName is gone.
          const { cardName, logoText, issuerName, issuerLogo } = useCardBuilderStore.getState();
          const { barcodeType, passValidDays, expiryDate, currency, isPaid } = useCardBuilderStore.getState();
          await onSave(cardId, {
            // Top-level SQL column value.
            name: cardName,
            settings: {
              // Logo Text now lives in JSONB settings.logoText (NEW key).
              logoText,
              issuerName,
              issuerLogo: issuerLogo || undefined,
              barcodeType,
              passValidDays,
              expiryDate,
              currency,
              isPaid,
            },
          });
        } catch (err) {
          console.error('[handleNext] onSave failed:', err);
        }
      }
      // Step 3: persist logo + icon + background R2 keys + colors (Phase 8 of IconUploader plan 2026-08-31 + BackgroundUploader plan 2026-09-01 + Step 3 color picker 2026-09-03).
      // The MediaAssetUploader has already updated the store on upload, so we
      // just forward the current store values to onSave().
      // backgroundColor / textColor are stored with '#' prefix internally;
      // PassCreator contract is 6-char uppercase hex WITHOUT '#' (strip here).
      // Step 3 fields selector (plan 2026-09-04): also persist leftField / rightField.
      // Stamp grid feature (2026-09-04): also persist stampGridRows / stampIconId.
      if (step === 3 && cardId && onSave) {
        try {
          const { issuerLogo, iconImage, backgroundImage, backgroundColor, textColor } = useCardBuilderStore.getState();
          const { leftField, rightField, stampGridRows, stampIconId } = useCardBuilderStore.getState();
          await onSave(cardId, {
            issuerLogo: issuerLogo || undefined,
            iconImage: iconImage || undefined,
            backgroundImage: backgroundImage || undefined,
            backgroundColor: backgroundColor.replace('#', '').toUpperCase(),
            textColor: textColor.replace('#', '').toUpperCase(),
            leftField: leftField ?? undefined,
            rightField: rightField ?? undefined,
            stampGridRows: cardType === 'stamp_card' || cardType === 'multipass' ? stampGridRows : undefined,
            stampIconId: cardType === 'stamp_card' || cardType === 'multipass' ? (stampIconId || undefined) : undefined,
          });
          console.log('[handleNext] Step 3 image keys + colors + fields + stamp grid saved', { issuerLogo, iconImage, backgroundImage, backgroundColor, textColor, leftField, rightField, stampGridRows, stampIconId });
        } catch (err) {
          // Don't block step transition — let the user proceed and retry later.
          console.error('[handleNext] Step 3 onSave failed:', err);
        }
      }
      // Step 4: persist description + back fields + links (Step 4 card-info plan 2026-09-04).
      // - description: string (may be empty but the UI blocks Next when empty)
      // - backFields: array of { label, value } (UI always keeps ≥ 1 row)
      // - links: array of { label, value }, empty array allowed
      // Empty rows (label='' AND value='') are forwarded to the backend; the
      // backend zod schema accepts them (max-length validation only),
      // and the preview filters them out at render time.
      if (step === 4 && cardId && onSave) {
        try {
          const { description, backFields, links } = useCardBuilderStore.getState();
          await onSave(cardId, {
            description,
            backFields: backFields.map((f) => ({
              label: f.label,
              value: f.value,
            })),
            links: links.map((l) => ({
              label: l.label,
              value: l.value,
            })),
          });
          console.log('[handleNext] Step 4 card-info saved', { description, backFields, links });
        } catch (err) {
          // Don't block step transition — let the user proceed and retry later.
          console.error('[handleNext] Step 4 onSave failed:', err);
        }
      }
      // ===== Step 5 — 地理位置 + 推播訊息 (2026-09-05, refactored 2026-09-06) =====
      // Step 5 is conditional: when `locationsDisabled=true` (toggle off),
      // the store has already cleared `locations` and `locationsMaxDistance`
      // (via the setter). We echo the cleared payload so the DB stays in
      // sync. When `locationsDisabled=false`, we forward the user's typed
      // data — `isStep5Valid()` has already gated this branch so all rows
      // are well-typed and the radius is in [100, 1000].
      // Row-level validation is enforced by the shared zod schema on the
      // backend (Rule 019 + 032); here we only forward clean rows.
      if (step === 5 && cardId && onSave) {
        try {
          const {
            initialMessage,
            locationsDisabled,
            locationsMaxDistance,
            locations,
          } = useCardBuilderStore.getState();
          await onSave(cardId, {
            initialMessage,
            locationsDisabled,
            locationsMaxDistance,
            locations: locations.map((l) => ({
              name: l.name,
              latitude: l.latitude,
              longitude: l.longitude,
              relevantText: l.relevantText,
            })),
          });
          console.log('[handleNext] Step 5 location saved', {
            initialMessage,
            locationsDisabled,
            locationsMaxDistance,
            locations,
          });
        } catch (err) {
          // Don't block step transition — let the user proceed and retry later.
          console.error('[handleNext] Step 5 onSave failed:', err);
        }
      }
      // ===== Step 6 — 卡片邏輯 (2026-09-07 stamp; 2026-09-09 reward) =====
      // Store has Step 6 fields already gated by `isStep6Valid()`. For
      // non-stamp_card / non-reward_card card types the dispatcher renders
      // a ComingSoon placeholder and `isStep6Valid()` returns `true` so
      // this block is effectively a no-op (writes null/empty values into
      // the JSONB). The backend zod schema accepts all-null Step 6 fields
      // (`.optional()` + `.nullable()`); see Rule 019 § 4.1 mirror.
      //
      // 2026-09-07 round-trip fix: Step 6 must send ALL 9 fields, including
      // the 4 accrual thresholds (`stampsPerVisit*`, `stampsPerSpend*`).
      // Earlier commit omitted these — store kept them, but they never
      // reached the DB, so reload came back empty and the UI re-rendered
      // blank. Each threshold is `.nullable()` so non-stamp modes write
      // null cleanly without serializing the wrong type.
      //
      // 2026-09-09 reward_card extension (mixed refactor): `earningMode`
      // is CARD-WIDE (top-level), sent at the top of the payload. Each
      // `rewardTiers[*]` entry carries only the per-tier earn rate
      // fields (pointsPerVisit / pointsPerSpendAmount /
      // pointsPerSpendPoints) — earningMode itself is no longer per-tier.
      if (step === 6 && cardId && onSave) {
        try {
          const {
            stampAccrualMode,
            rewardName,
            rewardType,
            rewardValue,
            maxDiscountAmount,
            stampsPerVisitCount,
            stampsPerVisitStamps,
            stampsPerSpendAmount,
            stampsPerSpendStamps,
            earningMode,
            rewardTiers,
            cashbackTiers,
            hasExpiry,
            membershipTiers,
          } = useCardBuilderStore.getState();
          // Strip `id` field from each reward tier before sending to backend
          // (id is a UI-only React key, not part of the data contract).
          // 2026-09-09 mixed refactor: rewardTiers no longer carries a
          // per-tier earningMode — that's top-level now. Each tier only
          // serializes its per-tier earn rate fields inline.
          const sanitizedRewardTiers = rewardTiers.map((tier) => ({
            name: tier.name,
            threshold: tier.threshold,
            rewardType: tier.rewardType,
            rewardValue: tier.rewardValue,
            maxDiscountAmount: tier.maxDiscountAmount,
            // Per-tier earn rate fields (no per-tier earningMode)
            pointsPerVisit: tier.pointsPerVisit ?? null,
            pointsPerSpendAmount: tier.pointsPerSpendAmount ?? null,
            pointsPerSpendPoints: tier.pointsPerSpendPoints ?? null,
          }));
          // 2026-09-11 Cashback: strip `id` from each cashback tier too.
          // Sort by thresholdSpend ASC (threshold=0 first = default tier)
          // so the persisted array matches the UI sort order.
          const sanitizedCashbackTiers = cashbackTiers
            .slice()
            .sort((a, b) => a.thresholdSpend - b.thresholdSpend)
            .map((tier) => ({
              name: tier.name,
              thresholdSpend: tier.thresholdSpend,
              cashbackPercent: tier.cashbackPercent,
            }));
          // 2026-09-13 Membership: strip `id` and per-tier reward `id`s.
          // membershipTiers carry name + durationType + monthlyCost +
          // yearlyCost + rewards (each with label + value, no id sent).
          const sanitizedMembershipTiers = membershipTiers.map((tier) => ({
            name: tier.name,
            durationType: tier.durationType,
            monthlyCost: tier.monthlyCost,
            yearlyCost: tier.yearlyCost,
            rewards: (tier.rewards ?? []).map((reward) => ({
              label: reward.label,
              value: reward.value,
            })),
          }));
          await onSave(cardId, {
            stampAccrualMode,
            rewardName,
            rewardType,
            rewardValue,
            maxDiscountAmount,
            // Accrual thresholds — only meaningful for per_visit / per_spend,
            // but always sent (null otherwise) so the DB always reflects the
            // current store state. loadSettings coerces non-matching values
            // back to null.
            stampsPerVisitCount,
            stampsPerVisitStamps,
            stampsPerSpendAmount,
            stampsPerSpendStamps,
            // REWARD 卡 (2026-09-09 mixed refactor) — earningMode is at
            // top level (one mode per card). rewardTiers carries only
            // per-tier earn rate fields (no per-tier earningMode).
            earningMode,
            rewardTiers: sanitizedRewardTiers,
            // CASHBACK 卡 (2026-09-11) — only meaningful for cashback_card,
            // but always sent so the DB always reflects the current store
            // state. loadSettings coerces non-matching values back to [].
            cashbackTiers: sanitizedCashbackTiers,
            // MEMBERSHIP 卡 (2026-09-13) — only meaningful for membership_card,
            // but always sent so the DB always reflects the current store state.
            hasExpiry,
            membershipTiers: sanitizedMembershipTiers,
          });
          console.log('[handleNext] Step 6 card logic saved', {
            stampAccrualMode,
            rewardName,
            rewardType,
            rewardValue,
            maxDiscountAmount,
            stampsPerVisitCount,
            stampsPerVisitStamps,
            stampsPerSpendAmount,
            stampsPerSpendStamps,
            earningMode,
            rewardTiers: sanitizedRewardTiers,
            cashbackTiers: sanitizedCashbackTiers,
            hasExpiry,
            membershipTiers: sanitizedMembershipTiers,
          });
        } catch (err) {
          // Don't block step transition — let the user proceed and retry later.
          console.error('[handleNext] Step 6 onSave failed:', err);
        }
      }
      onStepChange((step + 1) as EditorStep);
    }
  }

  function handlePrev() {
    if (step > 1) {
      onStepChange((step - 1) as EditorStep);
    }
  }

  return (
    <aside className={`flex min-w-0 w-full flex-col gap-6 bg-muted p-6 ${className || ''}`} {...rest}>
      {/* min-w-0: defensive — prevents the aside from being stretched by its
          children's min-content (notably the LogoUploader crop stage's inline
          width on mobile). See feedback 20260830. */}
      {/* Step 1: 卡片類型選擇器 */}
      {step === 1 && (
        <section className="flex min-w-0 flex-col gap-6">
          <h2 className="text-lg font-semibold text-foreground">
            {t('step1.title')}
          </h2>
          <CardTypeSelector value={cardType} onChange={onCardTypeChange} />
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              className="
                flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5
                text-sm font-medium text-foreground
                transition-all duration-150
                hover:scale-[1.02] hover:border-primary hover:text-primary
                active:scale-[0.98]
              "
            >
              <ChevronLeft size={16} aria-hidden="true" />
              {t('actions.backToLibrary')}
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!cardType}
              className="
                flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5
                text-sm font-semibold text-on-primary
                transition-all duration-150
                hover:scale-[1.02] hover:shadow-[var(--shadow-glow)]
                active:scale-[0.98]
                disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100
              "
            >
              {t('step1.next')}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* Step 2: 卡片設定 */}
      {step === 2 && (
        <section className="flex min-w-0 flex-col gap-6">
          <h2 className="text-lg font-semibold text-foreground">
            {t('step2.title')}
          </h2>
          <Step2CardSettings showValidation={!isStep2Valid()} />
          {/* 上一步 / 下一步按鈕 */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handlePrev}
              className="
                flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5
                text-sm font-medium text-foreground
                transition-all duration-150
                hover:scale-[1.02] hover:border-primary hover:text-primary
                active:scale-[0.98]
              "
            >
              <ChevronLeft size={16} aria-hidden="true" />
              {t('actions.prev')}
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!isStep2Valid()}
              className="
                flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5
                text-sm font-semibold text-on-primary
                transition-all duration-150
                hover:scale-[1.02] hover:shadow-[var(--shadow-glow)]
                active:scale-[0.98]
                disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100
              "
            >
              {t('step1.next')}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* Step 3: 卡片設計（Logo + Icon 上傳） */}
      {step === 3 && (
        <section className="flex min-w-0 flex-col gap-6">
          <h2 className="text-lg font-semibold text-foreground">
            {t('step3.title')}
          </h2>

          {/* 既有 Logo 區塊 — 從既有的單一 LogoUploader 升級為 MediaAssetUploader variant="logo" */}
          <MediaAssetUploader
            variant="logo"
            templateId={cardId ?? ''}
            onUploaded={(key: string) => {
              console.log('[Step3] Logo uploaded:', key);
            }}
          />

          {/* Icon 區塊（Phase 8 — IconUploader plan 2026-08-31）
              - 在 Logo 下方,border-t 區隔
              - 推播通知圖示,不會出現在卡片模板本身（PreviewWrapper 只在 PhoneFrame 內 overlay）
              - 標題使用 font-semibold + font-family-heading(同 MediaAssetUploaderHeader)
                確保兩個變體的 heading 視覺一致
              - showHeader={false}：MediaAssetUploader 不再渲染內部 header,因為這層已自帶 */}
          <section className="flex min-w-0 flex-col gap-2 border-t pt-6">
            <h3
              className="text-base font-semibold text-foreground"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {t('step3.iconSection.title')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('step3.iconSection.hint')}
            </p>
            <MediaAssetUploader
              variant="icon"
              templateId={cardId ?? ''}
              showHeader={false}
              onUploaded={(key: string) => {
                console.log('[Step3] Icon uploaded:', key);
              }}
            />
          </section>

          {/* Background 區塊（BackgroundUploader plan 2026-09-01）
              - 在 Icon 下方,border-t 區隔
              - 背景圖顯示在卡片頂部 hero strip (PassCardPreviewStrip)
                size: 1860×738 像素（PassCreator spec）
              - 結構與 Icon 區塊對稱: <h3> + <p hint> + MediaAssetUploader showHeader={false}
              - showHeader={false}: MediaAssetUploader 不再渲染內部 header,
                因為這層已自帶 heading */}
          <section className="flex min-w-0 flex-col gap-2 border-t pt-6">
            <h3
              className="text-base font-semibold text-foreground"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {t('step3.backgroundSection.title')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('step3.backgroundSection.hint')}
            </p>
            <MediaAssetUploader
              variant="background"
              templateId={cardId ?? ''}
              showHeader={false}
              onUploaded={(key: string) => {
                console.log('[Step3] Background uploaded:', key);
              }}
            />
          </section>

          {/* Colors 區塊（Step 3 Color Picker plan 2026-09-03）
              - 在 Background section 之後,border-t 區隔
              - 渲染兩顆並列按鈕（背景色 / 文字色）+ popover 調色盤 + hex 輸入框
              - 與 icon / background section 對稱,採 parent section header pattern */}
          <Step3CardColors />

          {/* Fields 區塊（Step 3 Fields Selector plan 2026-09-04, plan id baffa936）
              - 在 Colors section 之後,border-t 區隔
              - 渲染兩個並排 native <select>（左欄位 / 右欄位）,
                每個 6 個共用選項 + 對側已選 disabled
              - 選擇 persist 到 store.leftField / rightField,
                並於 handleNext step 3 區段寫進 template_settings
              - 行為副作用（PassCardPreview 渲染等）留待後續計畫 */}
          <Step3CardFields />

          {/* Stamp grid 區塊（Stamp Grid feature 2026-09-04）
              - 條件渲染：僅在 cardType ∈ {stamp_card, multipass} 時顯示
              - 提供集點格數（1×5 / 2×5 / 3×5 / 4×5）+ 印章圖示選擇
              - 寫到 store.stampGridRows / store.stampIconId,
                並於 handleNext step 3 區段寫進 template_settings
              - PassCardPreviewStrip 在 isStampCard 分支 render StampGridPreview */}
          {(cardType === 'stamp_card' || cardType === 'multipass') && <Step3StampGrid />}

          {/* 上一步 / 下一步按鈕 */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handlePrev}
              className="
                flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5
                text-sm font-medium text-foreground
                transition-all duration-150
                hover:scale-[1.02] hover:border-primary hover:text-primary
                active:scale-[0.98]
              "
            >
              <ChevronLeft size={16} aria-hidden="true" />
              {t('actions.prev')}
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="
                flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5
                text-sm font-semibold text-on-primary
                transition-all duration-150
                hover:scale-[1.02] hover:shadow-[var(--shadow-glow)]
                active:scale-[0.98]
              "
            >
              {t('step1.next')}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* Step 4: 卡片資訊 — Description + Back fields + Links (2026-09-04) */}
      {step === 4 && (
        <section className="flex min-w-0 flex-col gap-6">
          <h2 className="text-lg font-semibold text-foreground">
            {t('step4.title')}
          </h2>
          <Step4CardInfo showValidation={!isStep4Valid()} />
          {/* 上一步 / 下一步按鈕 */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handlePrev}
              className="
                flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5
                text-sm font-medium text-foreground
                transition-all duration-150
                hover:scale-[1.02] hover:border-primary hover:text-primary
                active:scale-[0.98]
              "
            >
              <ChevronLeft size={16} aria-hidden="true" />
              {t('actions.prev')}
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!isStep4Valid()}
              className="
                flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5
                text-sm font-semibold text-on-primary
                transition-all duration-150
                hover:scale-[1.02] hover:shadow-[var(--shadow-glow)]
                active:scale-[0.98]
                disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100
              "
            >
              {t('step1.next')}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* Step 5: 地理位置 + 推播訊息 (2026-09-05, refactored 2026-09-06) */}
      {step === 5 && (
        <section className="flex min-w-0 flex-col gap-6">
          <h2 className="text-lg font-semibold text-foreground">
            {t('step5.title')}
          </h2>
          <Step5CardLocation showValidation={!isStep5Valid()} />
          {/* 上一步 / 下一步按鈕 */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handlePrev}
              className="
                flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5
                text-sm font-medium text-foreground
                transition-all duration-150
                hover:scale-[1.02] hover:border-primary hover:text-primary
                active:scale-[0.98]
              "
            >
              <ChevronLeft size={16} aria-hidden="true" />
              {t('actions.prev')}
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!isStep5Valid()}
              className="
                flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5
                text-sm font-semibold text-on-primary
                transition-all duration-150
                hover:scale-[1.02] hover:shadow-[var(--shadow-glow)]
                active:scale-[0.98]
                disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100
              "
            >
              {t('step1.next')}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* Step 6: 卡片邏輯 (2026-09-07, dispatcher + StampCardLogic sub-module) */}
      {step === 6 && (
        <section className="flex min-w-0 flex-col gap-6">
          <h2 className="text-lg font-semibold text-foreground">
            {t('step6.title')}
          </h2>
          <Step6CardLogic showValidation={!isStep6Valid()} />
          {/* 上一步 / 下一步按鈕 */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handlePrev}
              className="
                flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5
                text-sm font-medium text-foreground
                transition-all duration-150
                hover:scale-[1.02] hover:border-primary hover:text-primary
                active:scale-[0.98]
              "
            >
              <ChevronLeft size={16} aria-hidden="true" />
              {t('actions.prev')}
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!isStep6Valid()}
              className="
                flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5
                text-sm font-semibold text-on-primary
                transition-all duration-150
                hover:scale-[1.02] hover:shadow-[var(--shadow-glow)]
                active:scale-[0.98]
                disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100
              "
            >
              {t('step1.next')}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* Step 7: 客製化桌牌（預留） */}
      {step === 7 && (
        <section className="flex flex-col items-center justify-center gap-4 py-12">
          <p className="text-muted-foreground">
            {t('step7.title')}
          </p>
          <p className="text-sm text-muted-foreground/60">
            {t('comingSoon')}
          </p>
          {/* 上一步 / 下一步按鈕 */}
          <div className="flex items-center gap-4 pt-4">
            <button
              type="button"
              onClick={handlePrev}
              className="
                flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5
                text-sm font-medium text-foreground
                transition-all duration-150
                hover:scale-[1.02] hover:border-primary hover:text-primary
                active:scale-[0.98]
              "
            >
              <ChevronLeft size={16} aria-hidden="true" />
              {t('actions.prev')}
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="
                flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5
                text-sm font-semibold text-on-primary
                transition-all duration-150
                hover:scale-[1.02] hover:shadow-[var(--shadow-glow)]
                active:scale-[0.98]
              "
            >
              {t('step1.next')}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* Step 8: 保存（預留） */}
      {step === 8 && (
        <section className="flex flex-col items-center justify-center gap-4 py-12">
          <p className="text-muted-foreground">
            {t('step8.title')}
          </p>
          <p className="text-sm text-muted-foreground/60">
            {t('comingSoon')}
          </p>
          {/* 上一步 / 保存按鈕 */}
          <div className="flex items-center gap-4 pt-4">
            <button
              type="button"
              onClick={handlePrev}
              className="
                flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5
                text-sm font-medium text-foreground
                transition-all duration-150
                hover:scale-[1.02] hover:border-primary hover:text-primary
                active:scale-[0.98]
              "
            >
              <ChevronLeft size={16} aria-hidden="true" />
              {t('actions.prev')}
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled
              className="
                flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5
                text-sm font-semibold text-on-primary
                transition-all duration-150
                hover:scale-[1.02] hover:shadow-[var(--shadow-glow)]
                active:scale-[0.98]
                disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100
              "
            >
              {t('actions.save')}
            </button>
          </div>
        </section>
      )}
    </aside>
  );
}
