/**
 * passHolderService tests — mock + HTTP mode coverage.
 *
 * Two scenarios:
 *   1. MOCK MODE (default for `npm test`, set by .env.test):
 *      - `VITE_USE_PASS_MOCK=true` at module load → useMock=true → SAMPLE_TEMPLATES branch.
 *      - Existing demo-* tests run here.
 *
 *   2. HTTP MODE (set per-describe via `vi.stubEnv` + dynamic import):
 *      - `VITE_USE_PASS_MOCK=false` → useMock=false → httpClient branch.
 *      - We mock `./httpClient` to assert call wiring + error mapping.
 *
 * Critical: when `vi.resetModules()` runs (HTTP-mode setup), the dynamic
 * import of `./passHolderService` returns a FRESH module instance with
 * NEW `PassHolderError` / `PassHolderNotFoundError` class identities.
 * Mock-mode tests use the static import, which captures the original
 * module instance; HTTP-mode tests MUST use classes from the dynamic
 * import to keep `instanceof` checks valid.
 *
 * Decision log: runs/decisions/2026-09-29-pass-templates-public-endpoint.md
 *   § Decision 2 (env flag switch).
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  passHolderService as mockService,
  PassHolderError as MockPassHolderError,
  PassHolderNotFoundError as MockPassHolderNotFoundError,
} from './passHolderService';
import type { PassHolderPayload } from '@saome/shared/types/passHolder';

// =============================================================================
// Shared SaomeApiError class — used by both mock factories and test bodies
// so `instanceof` succeeds across module boundaries.
// =============================================================================

class SaomeApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly i18nKey?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly details?: Record<string, any>;
  constructor(
    status: number,
    body: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error?: { code?: string; i18nKey?: string; message?: string; details?: any };
      message?: string;
    },
  ) {
    super(body?.error?.message ?? body?.message ?? 'API error');
    this.name = 'SaomeApiError';
    this.status = status;
    this.code = body?.error?.code;
    this.i18nKey = body?.error?.i18nKey;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.details = body?.error?.details as any;
  }
}

// =============================================================================
// 1. MOCK MODE (default — VITE_USE_PASS_MOCK=true from .env.test)
//    All mock-mode tests use the static-imported service + error classes
//    (same module instance; `instanceof` always works).
// =============================================================================

describe('passHolderService.getTemplate (mock mode — VITE_USE_PASS_MOCK=true)', () => {
  it('returns a known demo-cafe template', async () => {
    const template = await mockService.getTemplate('demo-cafe');
    expect(template.id).toBe('demo-cafe');
    expect(template.cardType).toBe('reward_card');
    expect(template.issuerName).toBe('Café Rewards Co.');
    expect(template.logoText).toBe('Café 咖啡');
    expect(template.backgroundColor).toBeDefined();
    expect(template.textColor).toBeDefined();
  });

  it('returns each of the 8 supported cardType samples', async () => {
    const ids = [
      'demo-stamp',
      'demo-cashback',
      'demo-cafe',
      'demo-gym',
      'demo-discount',
      'demo-coupon',
      'demo-multipass',
      'demo-gift',
    ];
    for (const id of ids) {
      const t = await mockService.getTemplate(id);
      expect(t.id).toBe(id);
      expect(t.cardType).toBeTruthy();
    }
  });

  it('2026-10-16: demo-gym is a paid membership card (TWD, 2 tiers)', async () => {
    const t = await mockService.getTemplate('demo-gym');
    expect(t.isPaid).toBe(true);
    expect(t.currency).toBe('TWD');
    expect(t.membershipTiers).toHaveLength(2);
    expect(t.membershipTiers?.[0]?.name).toBe('Basic');
    expect(t.membershipTiers?.[1]?.name).toBe('VIP');
    expect(t.membershipTiers?.[0]?.monthlyCost).toBe(100);
    expect(t.membershipTiers?.[1]?.monthlyCost).toBe(200);
  });

  it('2026-10-16: demo-gym-zar is a paid membership card in ZAR (Payfast path)', async () => {
    const t = await mockService.getTemplate('demo-gym-zar');
    expect(t.isPaid).toBe(true);
    expect(t.currency).toBe('ZAR');
    expect(t.membershipTiers).toHaveLength(2);
    expect(t.membershipTiers?.[0]?.monthlyCost).toBe(500);
    expect(t.membershipTiers?.[1]?.monthlyCost).toBe(1000);
  });

  it('2026-10-16: non-paid templates (e.g. demo-cafe) have no membershipTiers / isPaid', async () => {
    const t = await mockService.getTemplate('demo-cafe');
    expect(t.isPaid).toBeUndefined();
    expect(t.membershipTiers).toBeUndefined();
    expect(t.currency).toBeUndefined();
  });

  it('throws PassHolderNotFoundError for unknown ids', async () => {
    await expect(mockService.getTemplate('does-not-exist')).rejects.toBeInstanceOf(
      MockPassHolderNotFoundError,
    );
  });

  it('not-found error carries the i18n key + params for translation', async () => {
    try {
      await mockService.getTemplate('nope');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MockPassHolderError);
      const e = err as InstanceType<typeof MockPassHolderError>;
      expect(e.i18nKey).toBe('passHolder.errors.templateNotFound');
      expect(e.params).toEqual({ id: 'nope' });
    }
  });
});

describe('passHolderService.register (mock mode)', () => {
  it('returns { ok: true, passHolderId: string }', async () => {
    const payload: PassHolderPayload = {
      name: '王小明',
      phoneCountryCode: '+886',
      phoneNumber: '0912345678',
      birthday: '1990-01-01',
      email: 'test@example.com',
    };
    const result = await mockService.register('demo-cafe', payload);
    expect(result.ok).toBe(true);
    expect(typeof result.passHolderId).toBe('string');
    expect(result.passHolderId.startsWith('mock-')).toBe(true);
  });

  it('accepts the +27 country code', async () => {
    const payload: PassHolderPayload = {
      name: 'Thabo Mokoena',
      phoneCountryCode: '+27',
      phoneNumber: '0712345678',
      birthday: '1990-01-01',
      email: 'thabo@example.com',
    };
    const result = await mockService.register('demo-gym', payload);
    expect(result.ok).toBe(true);
  });

  it('2026-10-16: register accepts paid-membership fields (selectedTierIndex / paymentProvider / status)', async () => {
    // 2026-10-27 — `membershipTierSnapshot` is no longer SENT by the
    // client (the backend derives it server-side), but the field is
    // still part of the wire contract for older deployed clients, so
    // the mock service must keep accepting it.
    const payload: PassHolderPayload = {
      name: '王小明',
      phoneCountryCode: '+886',
      phoneNumber: '0912345678',
      birthday: '1990-01-01',
      email: 'wang@example.com',
      selectedTierIndex: 1,
      membershipTierSnapshot: {
        index: 1,
        name: 'VIP',
        durationType: 'monthly',
        paidAmount: 200,
        currency: 'TWD',
      },
      paymentProvider: 'ecpay',
      paymentStatus: 'completed',
    };
    const result = await mockService.register('demo-gym', payload);
    expect(result.ok).toBe(true);
    expect(result.passHolderId.startsWith('mock-')).toBe(true);
  });
});

// =============================================================================
// 2. HTTP MODE (VITE_USE_PASS_MOCK=false via vi.stubEnv + dynamic import)
//    Error classes must come from the DYNAMIC import (fresh module
//    instance after vi.resetModules()).
// =============================================================================

type HttpClientMock = {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

const makeHttpMock = () => ({ get: vi.fn(), post: vi.fn() });

interface HttpModeHandles {
  httpService: typeof import('./passHolderService').passHolderService;
  PassHolderError: typeof import('./passHolderService').PassHolderError;
  PassHolderNotFoundError: typeof import('./passHolderService').PassHolderNotFoundError;
  mockHttp: HttpClientMock;
}

async function setupHttpMode(): Promise<HttpModeHandles> {
  const mockHttp = makeHttpMock();
  vi.stubEnv('VITE_USE_PASS_MOCK', 'false');
  vi.resetModules();
  vi.doMock('./httpClient', () => ({
    httpClient: mockHttp,
    SaomeApiError,
  }));
  const mod = await import('./passHolderService');
  return {
    httpService: mod.passHolderService,
    PassHolderError: mod.PassHolderError,
    PassHolderNotFoundError: mod.PassHolderNotFoundError,
    mockHttp,
  };
}

async function teardownHttpMode() {
  vi.unstubAllEnvs();
  vi.doUnmock('./httpClient');
  vi.resetModules();
}

describe('passHolderService.getTemplate (HTTP mode)', () => {
  let httpService: HttpModeHandles['httpService'];
  let mockHttp: HttpClientMock;
  let PassHolderError: HttpModeHandles['PassHolderError'];
  let PassHolderNotFoundError: HttpModeHandles['PassHolderNotFoundError'];

  beforeAll(async () => {
    const setup = await setupHttpMode();
    httpService = setup.httpService;
    mockHttp = setup.mockHttp;
    PassHolderError = setup.PassHolderError;
    PassHolderNotFoundError = setup.PassHolderNotFoundError;
  });

  afterAll(async () => {
    await teardownHttpMode();
  });

  beforeEach(() => {
    mockHttp.get.mockReset();
    mockHttp.post.mockReset();
  });

  it('calls httpClient.get with /api/pass-templates/:id/public', async () => {
    mockHttp.get.mockResolvedValueOnce({
      template: {
        id: '716c4244-6c63-496d-a967-6c87cdac605d',
        name: 'Café Rewards',
        cardType: 'reward_card',
        logoText: 'Café 咖啡',
        issuerName: 'Café Rewards Co.',
        backgroundColor: '#0F0F23',
        textColor: '#F8FAFC',
      },
    });

    const result = await httpService.getTemplate('716c4244-6c63-496d-a967-6c87cdac605d');

    expect(mockHttp.get).toHaveBeenCalledTimes(1);
    expect(mockHttp.get).toHaveBeenCalledWith(
      '/api/pass-templates/716c4244-6c63-496d-a967-6c87cdac605d/public',
    );
    expect(result.id).toBe('716c4244-6c63-496d-a967-6c87cdac605d');
    expect(result.cardType).toBe('reward_card');
  });

  // 2026-10-16 — regression for the bug "付費會員卡沒有出現會原方案跟付費按鈕"
  // (paid membership card not showing tiers / payment buttons on the
  // public page). The backend MUST project `isPaid` / `membershipTiers`
  // / `currency` from `templates.settings` JSONB onto the public DTO;
  // the frontend PassHolderRegistration gates the tier section on
  // `template.isPaid && template.membershipTiers?.length`. If the HTTP
  // response drops these fields, the picker silently disappears.
  it('2026-10-16: passes through isPaid / membershipTiers / currency from HTTP response', async () => {
    mockHttp.get.mockResolvedValueOnce({
      template: {
        id: '738d9a5e-7f25-414b-b0d9-0c3abce8cf52',
        name: '搭哈哈',
        cardType: 'membership_card',
        logoText: '呼嚕嚕',
        issuerName: 'fdsgsdg',
        isPaid: true,
        currency: 'ZAR',
        membershipTiers: [
          {
            name: '嗯嗯',
            rewards: [{ label: 'ao6', value: 'huohoij' }],
            monthlyCost: 100,
            yearlyCost: null,
            durationType: 'monthly',
          },
          {
            name: '貴',
            rewards: [{ label: 'sadfasf', value: 'adsfasdf' }],
            monthlyCost: 200,
            yearlyCost: null,
            durationType: 'monthly',
          },
        ],
      },
    });

    const result = await httpService.getTemplate('738d9a5e-7f25-414b-b0d9-0c3abce8cf52');
    expect(result.isPaid).toBe(true);
    expect(result.currency).toBe('ZAR');
    expect(result.membershipTiers).toHaveLength(2);
    expect(result.membershipTiers?.[0]?.name).toBe('嗯嗯');
  });

  it('maps 404 SaomeApiError to PassHolderNotFoundError', async () => {
    const err = new SaomeApiError(404, {
      error: { code: 'NOT_FOUND', i18nKey: 'passHolder.errors.templateNotFound' },
    });
    mockHttp.get.mockRejectedValueOnce(err);

    await expect(httpService.getTemplate('does-not-exist')).rejects.toBeInstanceOf(
      PassHolderNotFoundError,
    );
  });

  it('maps 4xx with i18nKey to PassHolderError carrying the i18nKey', async () => {
    const err = new SaomeApiError(400, {
      error: {
        code: 'VALIDATION_ERROR',
        i18nKey: 'passHolder.errors.birthdayInvalid',
        details: { issues: [{ path: 'birthday', i18nKey: 'passHolder.errors.birthdayInvalid' }] },
      },
    });
    mockHttp.get.mockRejectedValueOnce(err);

    try {
      await httpService.getTemplate('any-id');
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(PassHolderError);
      const pe = e as InstanceType<typeof PassHolderError>;
      expect(pe.i18nKey).toBe('passHolder.errors.birthdayInvalid');
    }
  });

  it('maps 5xx without i18nKey to generic server error', async () => {
    const err = new SaomeApiError(500, {
      error: { code: 'INTERNAL_ERROR' },
    });
    mockHttp.get.mockRejectedValueOnce(err);

    try {
      await httpService.getTemplate('any-id');
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(PassHolderError);
      expect((e as InstanceType<typeof PassHolderError>).i18nKey).toBe(
        'common.error.serverError',
      );
    }
  });

  it('maps network failure (non-SaomeApiError) to generic server error', async () => {
    mockHttp.get.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    try {
      await httpService.getTemplate('any-id');
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(PassHolderError);
      expect((e as InstanceType<typeof PassHolderError>).i18nKey).toBe(
        'common.error.serverError',
      );
    }
  });
});

describe('passHolderService.register (HTTP mode)', () => {
  let httpService: HttpModeHandles['httpService'];
  let mockHttp: HttpClientMock;
  let PassHolderNotFoundError: HttpModeHandles['PassHolderNotFoundError'];

  beforeAll(async () => {
    const setup = await setupHttpMode();
    httpService = setup.httpService;
    mockHttp = setup.mockHttp;
    PassHolderNotFoundError = setup.PassHolderNotFoundError;
  });

  afterAll(async () => {
    await teardownHttpMode();
  });

  beforeEach(() => {
    mockHttp.post.mockReset();
  });

  it('calls httpClient.post with /api/pass-templates/:id/register + payload', async () => {
    mockHttp.post.mockResolvedValueOnce({
      ok: true,
      passHolderId: 'holder-new-uuid',
      created: true,
    });

    const payload: PassHolderPayload = {
      name: '王小明',
      phoneCountryCode: '+886',
      phoneNumber: '912345678',
      birthday: '1990-01-15',
      email: 'wang@example.com',
    };
    const result = await httpService.register('716c4244-6c63-496d-a967-6c87cdac605d', payload);

    expect(mockHttp.post).toHaveBeenCalledTimes(1);
    expect(mockHttp.post).toHaveBeenCalledWith(
      '/api/pass-templates/716c4244-6c63-496d-a967-6c87cdac605d/register',
      payload,
    );
    // 2026-10-19 — V3 issuance: the response now carries `created`
    // + `issuance` (undefined when template has no
    // passcreator_template_id, or when the create flow succeeded
    // but V3 was not invoked). `created: true` here because the
    // mock above specifies it.
    expect(result).toEqual({
      ok: true,
      passHolderId: 'holder-new-uuid',
      created: true,
      issuance: undefined,
    });
  });

  it('returns passHolderId even when created=false (idempotent re-register)', async () => {
    mockHttp.post.mockResolvedValueOnce({
      ok: true,
      passHolderId: 'holder-existing',
      created: false,
    });

    const payload: PassHolderPayload = {
      name: '王小明',
      phoneCountryCode: '+886',
      phoneNumber: '912345678',
      birthday: '1990-01-15',
      email: 'wang@example.com',
    };
    const result = await httpService.register('demo-id', payload);
    expect(result.passHolderId).toBe('holder-existing');
  });

  it('maps 404 (template not found) to PassHolderNotFoundError', async () => {
    const err = new SaomeApiError(404, {
      error: { code: 'NOT_FOUND', i18nKey: 'passHolder.errors.templateNotFound' },
    });
    mockHttp.post.mockRejectedValueOnce(err);

    const payload: PassHolderPayload = {
      name: '王小明',
      phoneCountryCode: '+886',
      phoneNumber: '912345678',
      birthday: '1990-01-15',
      email: 'wang@example.com',
    };
    await expect(httpService.register('does-not-exist', payload)).rejects.toBeInstanceOf(
      PassHolderNotFoundError,
    );
  });
});