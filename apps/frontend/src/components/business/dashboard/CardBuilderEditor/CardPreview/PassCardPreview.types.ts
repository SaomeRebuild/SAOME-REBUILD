/**
 * PassCardPreview — Props
 *
 * The card template itself only renders logo / type label / holder name /
 * barcode — no icon or background image injected. The icon image preview
 * lives in MediaAssetUploader/Preview (128×128 panel in the editor
 * workspace).
 */

/** Apple Pass 標準尺寸比例 */
export const PASS_ASPECT_RATIO = {
  width: 375,
  height: 503,
  ratio: '375 / 503',
} as const;

import type { HTMLAttributes } from 'react';
import type { CardType } from '@/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.types';
import type { BarcodeType } from '@saome/shared/schemas/cardBuilder';
import type { CardFieldKey } from '@saome/shared/constants/card-fields';
import type { StampGridRows } from '@/components/business/stampCard/StampGridPreview';

/** 卡片預覽 Props */
export interface PassCardPreviewProps extends HTMLAttributes<HTMLDivElement> {
  /** 卡片名稱 */
  name?: string;
  /** 卡片類型
   *
   * Drives three independent pieces of preview rendering:
   *   - `PassCardPreviewHeader` — 2-line balance preview when
   *     `cardType ∈ {stamp_card, reward_card, cashback_card}`,
   *     rounded-full pill otherwise.
   *   - `PassCardPreviewStrip` — stamp grid icon row when
   *     `cardType ∈ {stamp_card, multipass}`.
   *   - `PassCardPreviewBody` — `memberLevel` slot becomes "獎勵 / Reward"
   *     when cardType ∈ {stamp_card, reward_card}:
   *       * stamp_card  → label = stampLabel, value = `rewardName`
   *                        (Step 6 top-level `rewardName` input).
   *       * reward_card → label = stampLabel, value = `firstRewardTierName`
   *                        (Step 6 `rewardTiers[0].name` — first row only).
   *     (2026-09-10 stamp card member-level → reward refactor; extended
   *     2026-09-10 to also cover reward_card.)
   */
  cardType?: CardType | null;
  /** 發卡機構標誌（可選，URL 或 SVG） */
  issuerLogo?: string;
  /** 卡片背景圖（可選，R2 URL）— 套用到整張卡片，而非僅 strip */
  backgroundImage?: string;
  /** 卡片背景色（可選）— 當無背景圖時作為卡片本體背景色（預設白色） */
  backgroundColor?: string;
  /** 卡片文字色 */
  textColor?: string;
  /** 顯示的面（正面/背面） */
  side?: 'front' | 'back';
  /** 持有人名稱（背面顯示） */
  holderName?: string;
  /** Barcode 格式 */
  barcodeType?: BarcodeType;
  /** 緊湊模式（用於手機框架內，縮小字體和間距） */
  compact?: boolean;
  /**
   * 左欄位選取的 field key（null = 顯示 placeholder）
   * 對應 templateSettings.leftField（DB 層）。當 null/undefined 時，body 顯示 placeholder。
   * 對應 PassCreator secondaryFields[0]：label = fieldPreview.{key}.label, value = fieldPreview.{key}.value。
   */
  leftField?: CardFieldKey | null;
  /**
   * 右欄位選取的 field key（null = 顯示 placeholder）
   * 對應 templateSettings.rightField（DB 層）。當 null/undefined 時，body 顯示 placeholder。
   * 對應 PassCreator secondaryFields[1]：label = fieldPreview.{key}.label, value = fieldPreview.{key}.value。
   */
  rightField?: CardFieldKey | null;
  /**
   * 集點印章：行數（1..4）。對應 templateSettings.stampGridRows。
   * 與 cardType + stampIconId 共同決定 strip 是否 render StampGridPreview。
   * Stamp grid feature 2026-09-04。
   */
  stampGridRows?: StampGridRows;
  /**
   * 集點印章：icon manifest id（例如 'bell'）。對應 templateSettings.stampIconId。
   * 空字串或 undefined 時，strip 維持既有 CreditCard icon + name 渲染。
   * Stamp grid feature 2026-09-04。
   */
  stampIconId?: string;
  /**
   * Live reward name from the editor store (Step 6 `step6-reward-name`
   * input). Surfaced as the preview `value` for the `memberLevel` slot when
   * `cardType === 'stamp_card'` (PassCardPreviewBody applies the
   * stamp-card → reward override). Optional — when omitted or empty, the
   * preview renders an empty value.
   * (2026-09-10 stamp card member-level → reward refactor.)
   */
  rewardName?: string;
  /**
   * First reward tier name from the editor store (Step 6
   * `rewardTiers[0].name`). Surfaced as the preview `value` for the
   * `memberLevel` slot when `cardType === 'reward_card'`. Optional — when
   * omitted / empty / when the tier array is empty, the preview renders an
   * empty value (matches stamp_card empty-input UX). Differs from
   * `rewardName` only in the data source: reward_card uses a multi-tier
   * structure, so the value reads the FIRST tier's name instead of a
   * top-level string.
   * (2026-09-10 reward card member-level → reward refactor extension.)
   */
  firstRewardTierName?: string;
  /**
   * 卡片描述（背面 Section 1）。對應 templateSettings.description。
   * Step 4 card-info 2026-09-04。空字串或 undefined 時，預覽顯示 placeholder。
   */
  description?: string;
  /**
   * 背面欄位（背面 Section 4）。對應 templateSettings.backFields。
   * Step 4 card-info 2026-09-04。空陣列或 undefined 時，預覽顯示 placeholder。
   */
  backFields?: ReadonlyArray<{ label: string; value: string }>;
  /**
   * 專屬連結（背面 Section 5）。對應 templateSettings.links。
   * Step 4 card-info 2026-09-04。空陣列或 undefined 時，預覽顯示 empty hint。
   */
  links?: ReadonlyArray<{ label: string; value: string }>;
}
