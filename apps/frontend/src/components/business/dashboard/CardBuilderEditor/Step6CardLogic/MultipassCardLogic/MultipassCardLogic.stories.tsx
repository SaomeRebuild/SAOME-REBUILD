/**
 * MultipassCardLogic — Storybook Stories (Rule 025 § 3)
 *
 * Stories cover the multipass editor's most important scenarios:
 *   - Default: shows the auto-seeded 1-row tier (stampsNeeded=0 welcome gift).
 *   - Max Tiers: 5 rows at MAX_MULTIPASS_TIERS=5; add button disabled +
 *     maxTiersReached hint shown.
 *   - With Duplicate Warning: 3 tiers where 2 share stampsNeeded=5. PR-4
 *     (2026-09-19) renders an AlertTriangle warning icon + tooltip next
 *     to the duplicated rows' stampsNeeded labels. Pure UI hint — does
 *     NOT block advancing; user can still hit Next.
 *
 * 2026-09-20 PR-5 stories added:
 *   - PerVisitMode: card-wide accrual mode = per_visit + tier with
 *     visit thresholds.
 *   - PerSpendModeZAR: card-wide accrual mode = per_spend + currency=ZAR
 *     + tier with spend thresholds (verifies R PREFIX vs TWD suffix).
 *   - PerVisitAccrualModeField: just the radio group (no tier list).
 *   - TierThresholdFieldPerVisit: just the per-tier threshold field
 *     (in per_visit mode, no card-wide radio).
 *
 * Plan ref: step6_multipass_模組化實作 plan 2026-09-19 § Phase 6.3 stories,
 *          step6_multipass_pr-5_accrual_mode 2026-09-20 § Layer 8.6.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { MultipassCardLogic } from './MultipassCardLogic';
import { MultipassAccrualModeField } from './MultipassAccrualModeField';
import { MultipassTierAccrualThresholdField } from './MultipassTierAccrualThresholdField';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

const meta = {
  title: 'Business/CardBuilderEditor/MultipassCardLogic',
  component: MultipassCardLogic,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'card' },
  },
  decorators: [
    (Story) => {
      useCardBuilderStore.getState().reset();
      return <Story />;
    },
  ],
} satisfies Meta<typeof MultipassCardLogic>;

export default meta;
type Story = StoryObj<typeof meta>;

// ===== Default (auto-seeded 1 row, stampsNeeded=0 welcome gift) =====

export const Default: Story = {
  render: () => <MultipassCardLogic showValidation={false} />,
};

// ===== With Validation Errors (empty name surfaces red border) =====

export const WithValidationErrors: Story = {
  render: () => {
    // Default 1-row tier has empty name + null rewardType → both surface
    // validation errors when showValidation=true.
    return <MultipassCardLogic showValidation={true} />;
  },
};

// ===== Max Tiers (5 rows at MAX_MULTIPASS_TIERS=5) =====

export const MaxTiers: Story = {
  render: () => {
    useCardBuilderStore.setState({
      multipassTiers: [
        { id: 't-0', name: '新戶禮', stampsNeeded: 0, rewardType: 'amount_off', rewardValue: 10 },
        { id: 't-1', name: '銅卡', stampsNeeded: 5, rewardType: 'percent_off', rewardValue: 5 },
        { id: 't-2', name: '銀卡', stampsNeeded: 10, rewardType: 'percent_off', rewardValue: 10 },
        { id: 't-3', name: '金卡', stampsNeeded: 20, rewardType: 'percent_off', rewardValue: 15 },
        { id: 't-4', name: 'VIP', stampsNeeded: 50, rewardType: 'amount_off', rewardValue: 100 },
      ],
    });
    return <MultipassCardLogic showValidation={false} />;
  },
};

// ===== With Duplicate Warning (PR-4 — warning icon now visible) =====

export const WithDuplicateWarning: Story = {
  render: () => {
    // 2026-09-19 PR-4: when 2+ tiers share the same stampsNeeded, the
    // MultipassTierStampsNeededField renders an AlertTriangle icon
    // + i18n tooltip next to the label (data-testid:
    // step6-multipass-{tierId}-stamps-duplicate-warning). Pure UI hint —
    // user can still advance. Demo shows 3 tiers where t-0 + t-1 share
    // stampsNeeded=5 and t-2 is unique, mirroring the PR-4 conformance
    // test "shows warning on ALL 3 rows when 3 tiers share stampsNeeded=5"
    // (one is dropped here to keep the story readable).
    useCardBuilderStore.setState({
      multipassTiers: [
        { id: 't-0', name: '5次再訪 (A)', stampsNeeded: 5, rewardType: 'amount_off', rewardValue: 10 },
        { id: 't-1', name: '5次再訪 (B)', stampsNeeded: 5, rewardType: 'percent_off', rewardValue: 5 },
        { id: 't-2', name: '10次再訪', stampsNeeded: 10, rewardType: 'amount_off', rewardValue: 20 },
      ],
    });
    return <MultipassCardLogic showValidation={false} />;
  },
};

// ===== Mixed Currency (TWD zh-TW, TWD en, ZAR) =====

export const TWDCurrencyZhTW: Story = {
  render: () => {
    useCardBuilderStore.setState({
      currency: 'TWD',
    });
    useCardBuilderStore.setState({
      multipassTiers: [
        { id: 't-0', name: '新戶禮', stampsNeeded: 0, rewardType: 'amount_off', rewardValue: 10 },
      ],
    });
    return <MultipassCardLogic showValidation={false} />;
  },
};

export const ZARCurrency: Story = {
  render: () => {
    useCardBuilderStore.setState({
      currency: 'ZAR',
    });
    useCardBuilderStore.setState({
      multipassTiers: [
        { id: 't-0', name: 'Welcome gift', stampsNeeded: 0, rewardType: 'amount_off', rewardValue: 50, perVisitCount: null, perVisitStamps: null, perSpendAmount: null, perSpendStamps: null },
      ],
    });
    return <MultipassCardLogic showValidation={false} />;
  },
};

// ===== PR-5 (2026-09-20) — Accrual mode + per-tier threshold stories =====

export const PerVisitMode: Story = {
  render: () => {
    // Card-wide accrual mode = per_visit + tier with N=2 visits / M=1 stamp
    useCardBuilderStore.setState({
      multipassAccrualMode: 'per_visit',
      multipassTiers: [
        {
          id: 't-0',
          name: '銅卡',
          stampsNeeded: 5,
          rewardType: 'amount_off',
          rewardValue: 10,
          perVisitCount: 2,
          perVisitStamps: 1,
          perSpendAmount: null,
          perSpendStamps: null,
        },
      ],
    });
    return <MultipassCardLogic showValidation={false} />;
  },
};

export const PerSpendModeZAR: Story = {
  render: () => {
    // Card-wide accrual mode = per_spend + currency=ZAR + per-tier
    // perSpendAmount (R PREFIX on input).
    useCardBuilderStore.setState({
      currency: 'ZAR',
      multipassAccrualMode: 'per_spend',
      multipassTiers: [
        {
          id: 't-0',
          name: '銀卡',
          stampsNeeded: 10,
          rewardType: 'percent_off',
          rewardValue: 5,
          perVisitCount: null,
          perVisitStamps: null,
          perSpendAmount: 100,
          perSpendStamps: 1,
        },
      ],
    });
    return <MultipassCardLogic showValidation={false} />;
  },
};

export const PerSpendModeTWD: Story = {
  render: () => {
    // Card-wide accrual mode = per_spend + currency=TWD + per-tier
    // perSpendAmount (元 SUFFIX after input).
    useCardBuilderStore.setState({
      currency: 'TWD',
      multipassAccrualMode: 'per_spend',
      multipassTiers: [
        {
          id: 't-0',
          name: '金卡',
          stampsNeeded: 10,
          rewardType: 'percent_off',
          rewardValue: 10,
          perVisitCount: null,
          perVisitStamps: null,
          perSpendAmount: 100,
          perSpendStamps: 1,
        },
      ],
    });
    return <MultipassCardLogic showValidation={false} />;
  },
};

// ===== PR-5 — isolated sub-component stories =====

export const AccrualModeFieldStandalone: StoryObj<{ mode: 'per_stamp' | 'per_visit' | 'per_spend' | null }> = {
  args: { mode: null },
  render: (args) => {
    useCardBuilderStore.setState({ multipassAccrualMode: args.mode });
    return <MultipassAccrualModeField showValidation={false} />;
  },
};

export const TierAccrualThresholdFieldPerVisit: Story = {
  render: () => {
    useCardBuilderStore.setState({
      multipassAccrualMode: 'per_visit',
      multipassTiers: [
        {
          id: 't-0',
          name: '銅卡',
          stampsNeeded: 5,
          rewardType: null,
          rewardValue: null,
          perVisitCount: 2,
          perVisitStamps: 1,
          perSpendAmount: null,
          perSpendStamps: null,
        },
      ],
    });
    return <MultipassTierAccrualThresholdField showValidation={false} tierId="t-0" />;
  },
};

export const TierAccrualThresholdFieldPerSpendZAR: Story = {
  render: () => {
    useCardBuilderStore.setState({
      currency: 'ZAR',
      multipassAccrualMode: 'per_spend',
      multipassTiers: [
        {
          id: 't-0',
          name: '銀卡',
          stampsNeeded: 10,
          rewardType: null,
          rewardValue: null,
          perVisitCount: null,
          perVisitStamps: null,
          perSpendAmount: 100,
          perSpendStamps: 1,
        },
      ],
    });
    return <MultipassTierAccrualThresholdField showValidation={false} tierId="t-0" />;
  },
};

export const TierAccrualThresholdFieldPerSpendTWD: Story = {
  render: () => {
    useCardBuilderStore.setState({
      currency: 'TWD',
      multipassAccrualMode: 'per_spend',
      multipassTiers: [
        {
          id: 't-0',
          name: '金卡',
          stampsNeeded: 10,
          rewardType: null,
          rewardValue: null,
          perVisitCount: null,
          perVisitStamps: null,
          perSpendAmount: 100,
          perSpendStamps: 1,
        },
      ],
    });
    return <MultipassTierAccrualThresholdField showValidation={false} tierId="t-0" />;
  },
};
