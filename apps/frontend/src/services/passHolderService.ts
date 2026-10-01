/**
 * passHolderService — HTTP-backed implementation of the public "Get Pass"
 * page, with a mock fallback for local dev when the backend isn't running.
 *
 * Concept (per plan 2026-09-28):
 *   - The target is "Pass Holder" (wallet-card end-user), NOT a SAOME
 *     platform member. Captured data is pass-delivery info, never login
 *     credentials.
 *   - Backend writes target a new `public.pass_holders` table (separate
 *     from `public.members`).
 *
 * Runtime mode (Decision 2 — runs/decisions/2026-09-29-pass-templates-public-endpoint.md):
 *   - `VITE_USE_PASS_MOCK === 'true'` → use the SAMPLE_TEMPLATES mock.
 *     Default OFF in dev / prod. Enable manually when the backend is
 *     down (or you want to develop the UI without spinning up wrangler).
 *   - Otherwise → call the backend via `httpClient`.
 *     Production is the only "real" path; mock is a dev-only fallback.
 *
 *   Tree-shake: in production builds where `VITE_USE_PASS_MOCK` is not
 *   set, the mock branch is dead code and gets removed by Vite's DCE.
 *   SAMPLE_TEMPLATES' image URLs (picsum.photos) and the mock console.info
 *   do NOT end up in production bundles.
 */

import { httpClient, SaomeApiError } from './httpClient';
import { api } from '@/config/api';
import type {
  PassHolderService,
  PublicPassTemplate,
  PassHolderPayload,
} from '@saome/shared/types/passHolder';

const useMock = import.meta.env.VITE_USE_PASS_MOCK === 'true';

/**
 * Lightweight error class that carries an i18n key + interpolation params
 * so consumers can render a localized message via `t(key, params)`.
 *
 * Today both mock and HTTP layers throw this shape; frontend UI translation
 * works the same regardless of which branch ran.
 */
export class PassHolderError extends Error {
  readonly i18nKey: string;
  readonly params?: Record<string, string | number>;

  constructor(i18nKey: string, params?: Record<string, string | number>) {
    super(i18nKey);
    this.name = 'PassHolderError';
    this.i18nKey = i18nKey;
    this.params = params;
  }
}

/** Convenience subclass for 404-style "not found" responses. */
export class PassHolderNotFoundError extends PassHolderError {
  constructor(id?: string) {
    super('passHolder.errors.templateNotFound', id ? { id } : undefined);
    this.name = 'PassHolderNotFoundError';
  }
}

/** Simulate network latency (mock-only). */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Eight sample templates — one per supported `CardType` so the editor /
 * preview / register flow can be exercised for every card design.
 *
 * Image URLs use a generic placeholder service (`picsum.photos`) — these
 * are public demo URLs and avoid leaking any tenant-specific assets.
 * Unsplash URLs (from earlier drafts) were avoided because they require
 * API key auth and break in offline test runs.
 *
 * IMPORTANT: This block is dead code in production builds (Vite DCE strips
 * it when `VITE_USE_PASS_MOCK` is not set). No need to manually guard.
 */
const SAMPLE_TEMPLATES: Record<string, PublicPassTemplate> = {
  'demo-stamp': {
    id: 'demo-stamp',
    name: 'Stamp Club',
    cardType: 'stamp_card',
    logoText: 'Stamp Club',
    issuerName: 'Stamp Club Co.',
    language: 'en',
    issuerLogo: 'https://picsum.photos/seed/saome-stamp/96',
    backgroundColor: '#1F2937',
    textColor: '#F9FAFB',
  },
  'demo-cashback': {
    id: 'demo-cashback',
    name: 'Cashback Plus',
    cardType: 'cashback_card',
    logoText: 'Cashback Plus',
    issuerName: 'Cashback Plus Ltd.',
    language: 'en',
    issuerLogo: 'https://picsum.photos/seed/saome-cashback/96',
    backgroundColor: '#0F172A',
    textColor: '#F8FAFC',
  },
  'demo-cafe': {
    id: 'demo-cafe',
    name: 'Café Rewards',
    cardType: 'reward_card',
    logoText: 'Café 咖啡',
    issuerName: 'Café Rewards Co.',
    language: 'en',
    issuerLogo: 'https://picsum.photos/seed/saome-cafe/96',
    backgroundColor: '#0F0F23',
    textColor: '#F8FAFC',
  },
  'demo-gym': {
    id: 'demo-gym',
    name: 'FitClub Membership',
    cardType: 'membership_card',
    logoText: 'FitClub',
    issuerName: 'FitClub Taiwan',
    language: 'en',
    issuerLogo: 'https://picsum.photos/seed/saome-gym/96',
    backgroundColor: '#064E3B',
    textColor: '#ECFDF5',
  },
  'demo-discount': {
    id: 'demo-discount',
    name: 'Discount Lane',
    cardType: 'discount_card',
    logoText: 'Discount Lane',
    issuerName: 'Discount Lane Inc.',
    language: 'en',
    issuerLogo: 'https://picsum.photos/seed/saome-discount/96',
    backgroundColor: '#7C2D12',
    textColor: '#FFF7ED',
  },
  'demo-coupon': {
    id: 'demo-coupon',
    name: 'Coupon Hub',
    cardType: 'coupon_card',
    logoText: 'Coupon Hub',
    issuerName: 'Coupon Hub Ltd.',
    language: 'en',
    issuerLogo: 'https://picsum.photos/seed/saome-coupon/96',
    backgroundColor: '#312E81',
    textColor: '#EEF2FF',
  },
  'demo-multipass': {
    id: 'demo-multipass',
    name: 'MultiPass Collective',
    cardType: 'multipass',
    logoText: 'MultiPass',
    issuerName: 'MultiPass Collective',
    language: 'en',
    issuerLogo: 'https://picsum.photos/seed/saome-multipass/96',
    backgroundColor: '#1E1B4B',
    textColor: '#F5F3FF',
  },
  'demo-gift': {
    id: 'demo-gift',
    name: 'Gift Card Studio',
    cardType: 'gift_card',
    logoText: 'Gift Studio',
    issuerName: 'Gift Card Studio',
    language: 'en',
    issuerLogo: 'https://picsum.photos/seed/saome-gift/96',
    backgroundColor: '#831843',
    textColor: '#FDF2F8',
  },
};

// =============================================================================
// Mock-mode helpers (only reachable when VITE_USE_PASS_MOCK === 'true')
// =============================================================================

function getMockTemplate(id: string): PublicPassTemplate {
  const template = SAMPLE_TEMPLATES[id];
  if (!template) {
    throw new PassHolderNotFoundError(id);
  }
  return template;
}

async function mockRegister(
  templateId: string,
  payload: PassHolderPayload,
): Promise<{ ok: true; passHolderId: string }> {
  await delay(500);
  // eslint-disable-next-line no-console
  console.info('[passHolderService.register] mock', { templateId, payload });
  return { ok: true, passHolderId: `mock-${Date.now()}` };
}

// =============================================================================
// HTTP-mode error mapping
// =============================================================================

/**
 * Convert an SaomeApiError (from httpClient) into a PassHolderError /
 * PassHolderNotFoundError. Preserves i18n key + params so the UI can
 * render the localized message via `t(key, params)`.
 *
 * Maps:
 *   - 404 (status OR i18nKey 'passHolder.errors.templateNotFound')
 *     → PassHolderNotFoundError(id)
 *   - any other 4xx / 5xx with an i18nKey
 *     → PassHolderError(i18nKey, details)
 *   - 5xx without i18nKey
 *     → PassHolderError('common.error.serverError')
 */
function toPassHolderError(err: unknown, idForNotFound?: string): PassHolderError {
  if (err instanceof SaomeApiError) {
    if (err.status === 404 || err.i18nKey === 'passHolder.errors.templateNotFound') {
      return new PassHolderNotFoundError(idForNotFound);
    }
    if (err.i18nKey) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new PassHolderError(err.i18nKey, err.details as any);
    }
    return new PassHolderError('common.error.serverError');
  }
  // Non-API errors (network failure, JSON parse, etc.) → fall through to a
  // generic server error so the UI shows a localized retry message rather
  // than the raw exception text.
  return new PassHolderError('common.error.serverError');
}

// =============================================================================
// Service
// =============================================================================

export const passHolderService: PassHolderService = {
  async getTemplate(id) {
    if (useMock) {
      await delay(300);
      return getMockTemplate(id);
    }
    try {
      const res = await httpClient.get<{ template: PublicPassTemplate }>(
        api.paths.passTemplate(id),
      );
      return res.template;
    } catch (err) {
      throw toPassHolderError(err, id);
    }
  },

  async register(templateId, payload) {
    if (useMock) {
      return mockRegister(templateId, payload);
    }
    try {
      const res = await httpClient.post<{ ok: true; passHolderId: string; created: boolean }>(
        api.paths.passRegister(templateId),
        payload,
      );
      return { ok: res.ok, passHolderId: res.passHolderId };
    } catch (err) {
      throw toPassHolderError(err, templateId);
    }
  },
};

export { SAMPLE_TEMPLATES };