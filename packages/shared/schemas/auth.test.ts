/**
 * Auth Schemas Tests (Vitest)
 */

import { describe, expect, it } from 'vitest';
import {
  accountInfoSchema,
  e164PhoneRegex,
  loginAttemptSchema,
  loginCredentialsSchema,
  lockoutStateSchema,
  normalizePhoneToE164,
  registerResponseSchema,
  registrationPayloadSchema,
  roleSchema,
  taxIdSchema,
  tenantInfoSchema,
} from './auth';

describe('normalizePhoneToE164', () => {
  it('passes through E.164 with leading + unchanged', () => {
    expect(normalizePhoneToE164('+886912345678')).toBe('+886912345678');
  });

  it('normalizes Taiwan bare 09xxxxxxxx → +8869xxxxxxxx', () => {
    expect(normalizePhoneToE164('0912345678')).toBe('+886912345678');
  });

  it('returns empty string when input is empty', () => {
    expect(normalizePhoneToE164('')).toBe('');
  });

  it('returns unknown bare format unchanged (will fail regex check)', () => {
    expect(normalizePhoneToE164('1234567')).toBe('1234567');
  });
});

describe('roleSchema', () => {
  it('accepts tenant and admin', () => {
    expect(roleSchema.parse('tenant')).toBe('tenant');
    expect(roleSchema.parse('admin')).toBe('admin');
  });

  it('rejects unknown roles', () => {
    expect(() => roleSchema.parse('superadmin')).toThrow();
  });
});

describe('taxIdSchema', () => {
  it('accepts "0" (no tax id)', () => {
    expect(taxIdSchema.parse('0')).toBe('0');
  });

  it('accepts 8 numeric digits', () => {
    expect(taxIdSchema.parse('12345678')).toBe('12345678');
  });

  it.each([
    ['empty string'],
    ['1234567'],
    ['123456789'],
    ['ABC12345'],
    ['1234567a'],
    [' 12345678'],
    ['12345678 '],
  ])('rejects %s', (input) => {
    expect(() => taxIdSchema.parse(input)).toThrow();
  });
});

describe('tenantInfoSchema', () => {
  const valid = {
    name: '王小明工作室',
    contactName: '王小明',
    phoneCity: '02-1234-5678',
    address: '台北市信義區信義路 1 號',
    taxId: '12345678',
    invoiceAddress: '台北市信義區信義路 1 號',
  };

  it('accepts valid tenant info with 8-digit taxId', () => {
    expect(() => tenantInfoSchema.parse(valid)).not.toThrow();
  });

  it('accepts valid tenant info with taxId "0"', () => {
    expect(() => tenantInfoSchema.parse({ ...valid, taxId: '0' })).not.toThrow();
  });

  it('rejects contactName too short', () => {
    expect(() => tenantInfoSchema.parse({ ...valid, contactName: 'A' })).toThrow();
  });

  it('rejects invalid taxId', () => {
    expect(() => tenantInfoSchema.parse({ ...valid, taxId: 'BAD' })).toThrow();
  });

  // mobile (optional E.164) — added 2026-07-31 per decision
  // runs/decisions/2026-07-31-add-mobile-field.md
  it('accepts E.164 mobile with leading +', () => {
    expect(() => tenantInfoSchema.parse({ ...valid, mobile: '+886912345678' })).not.toThrow();
  });

  it('accepts bare 10-digit Taiwan mobile without leading +', () => {
    expect(() => tenantInfoSchema.parse({ ...valid, mobile: '0912345678' })).not.toThrow();
  });

  it('rejects mobile shorter than 8 digits', () => {
    expect(() => tenantInfoSchema.parse({ ...valid, mobile: '+1234567' })).toThrow();
  });

  it('rejects mobile longer than 15 digits', () => {
    expect(() => tenantInfoSchema.parse({ ...valid, mobile: '+1234567890123456' })).toThrow();
  });

  it('rejects mobile starting with 0 after +', () => {
    expect(() => tenantInfoSchema.parse({ ...valid, mobile: '+01234567' })).toThrow();
  });

  it('rejects mobile with non-digit characters', () => {
    expect(() => tenantInfoSchema.parse({ ...valid, mobile: '+886-912-345-678' })).toThrow();
  });

  it('accepts empty mobile string (treated as null / not provided)', () => {
    const result = tenantInfoSchema.safeParse({ ...valid, mobile: '' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mobile).toBeNull();
    }
  });
});

describe('accountInfoSchema', () => {
  const base = {
    email: 'user-a@example.com',
    password: 'Password123',
    confirmPassword: 'Password123',
  };

  it('accepts matching passwords', () => {
    expect(() => accountInfoSchema.parse(base)).not.toThrow();
  });

  it('rejects mismatched passwords with passwordMismatch', () => {
    const result = accountInfoSchema.safeParse({
      ...base,
      confirmPassword: 'Mismatch999',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const confirmMsg = result.error.issues.find((i) => i.path.includes('confirmPassword'));
      expect(confirmMsg?.message ?? '').toContain('passwordMismatch');
    }
  });

  it('rejects malformed email', () => {
    expect(() => accountInfoSchema.parse({ ...base, email: 'not-an-email' })).toThrow();
  });

  it('rejects password below 8 chars', () => {
    expect(() => accountInfoSchema.parse({ ...base, password: 'short' })).toThrow();
  });

  // mobile was removed from accountInfoBase 2026-07-31 per decision
  // runs/decisions/2026-07-31-add-mobile-field.md. accountInfoBase only
  // carries email/password/confirmPassword (login-credential concerns);
  // mobile now lives on tenantInfoSchema (store-cellular-phone concern).
  it('does not accept mobile field on accountInfoSchema', () => {
    const result = accountInfoSchema.safeParse({
      ...base,
      mobile: '+886912345678',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).mobile).toBeUndefined();
    }
  });

  it('accepts optional website / businessEmail', () => {
    expect(() =>
      accountInfoSchema.parse({
        ...base,
        website: 'https://example.com',
        businessEmail: 'biz@example.com',
      }),
    ).not.toThrow();
  });
});

describe('loginCredentialsSchema', () => {
  it('accepts valid email + min 8-char password', () => {
    expect(() =>
      loginCredentialsSchema.parse({ email: 'login@example.com', password: 'Password123' }),
    ).not.toThrow();
  });

  it('rejects too-short password', () => {
    expect(() =>
      loginCredentialsSchema.parse({ email: 'login@example.com', password: 'short' }),
    ).toThrow();
  });

  it('rejects malformed email', () => {
    expect(() =>
      loginCredentialsSchema.parse({ email: 'nope', password: 'longenoughpw' }),
    ).toThrow();
  });
});

describe('lockoutStateSchema', () => {
  it('accepts locked=true with positive remainingSeconds', () => {
    expect(lockoutStateSchema.parse({ locked: true, remainingSeconds: 595 })).toEqual({
      locked: true,
      remainingSeconds: 595,
    });
  });

  it('rejects negative remainingSeconds', () => {
    expect(() => lockoutStateSchema.parse({ locked: true, remainingSeconds: -1 })).toThrow();
  });
});

describe('registrationPayloadSchema', () => {
  it('merges tenant info + account info (omits confirmPassword) and requires invoiceAddress', () => {
    const fullPayload = {
      name: '王小明工作室',
      contactName: '王小明',
      phoneCity: '02-1234-5678',
      address: '台北市信義區信義路 1 號',
      taxId: '12345678',
      invoiceAddress: '台北市信義區信義路 1 號',
      email: 'register@example.com',
      password: 'Password123',
    };
    expect(() => registrationPayloadSchema.parse(fullPayload)).not.toThrow();
  });
});

describe('registerResponseSchema', () => {
  it('parses well-formed response', () => {
    const ok = {
      accessToken: 'eyJ.fake.token',
      user: {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'resp@example.com',
        role: 'tenant' as const,
      },
      tenantId: '22222222-2222-2222-2222-222222222222',
    };
    expect(() => registerResponseSchema.parse(ok)).not.toThrow();
  });
});

describe('loginAttemptSchema', () => {
  it('accepts Date instance', () => {
    expect(() =>
      loginAttemptSchema.parse({
        id: 1,
        userId: null,
        emailAttempted: 'attempt@example.com',
        success: false,
        attemptedAt: new Date(),
      }),
    ).not.toThrow();
  });

  it('accepts millisecond timestamp', () => {
    expect(() =>
      loginAttemptSchema.parse({
        id: 2,
        userId: '11111111-1111-1111-1111-111111111111',
        emailAttempted: 'attempt@example.com',
        success: true,
        attemptedAt: Date.now(),
      }),
    ).not.toThrow();
  });
});
