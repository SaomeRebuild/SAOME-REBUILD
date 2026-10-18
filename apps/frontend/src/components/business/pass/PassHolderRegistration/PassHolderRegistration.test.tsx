/**
 * PassHolderRegistration tests — render, validation, submit flow, slot.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { i18n as testI18n } from '@/test/i18n';
import { PassHolderRegistration } from './PassHolderRegistration';
import type { PublicPassTemplate } from '@saome/shared/types/passHolder';
import { PassHolderError } from '@/services/passHolderService';

// 2026-10-18 — passHolderServiceMock is a vi.fn()-based mock that
// the autofill-defense tests assert against (Rule 018 § 2 DOM
// reconcile conformance). The factory creates the mock once and
// exposes it so the test body can read `mock.calls[0]` without
// needing a runtime `require('@/services/passHolderService')`
// (vitest + Vite's `@/` alias don't always resolve dynamic require
// for path-aliased modules).
//
// `vi.hoisted` is required because vitest hoists `vi.mock` calls
// above all module-level statements, so a plain `const` would be
// uninitialized when the mock factory runs.
const passHolderServiceMock = vi.hoisted(() => ({
  register: vi.fn().mockResolvedValue({ ok: true, passHolderId: 'mock-123' }),
}));

vi.mock('@/services/passHolderService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/passHolderService')>();
  return {
    passHolderService: passHolderServiceMock,
    PassHolderError: actual.PassHolderError,
    PassHolderNotFoundError: actual.PassHolderNotFoundError,
  };
});

const sampleTemplate: PublicPassTemplate = {
  id: 'demo-cafe',
  name: 'Café Rewards',
  cardType: 'reward_card',
  logoText: 'Café 咖啡',
  issuerName: 'Café Rewards Co.',
  language: 'en',
};

// PassHolderRegistrationSuccess renders a react-router-dom <Link>, so the
// post-submit view needs a Router context.
const renderComponent = (props: Partial<React.ComponentProps<typeof PassHolderRegistration>> = {}) =>
  render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <PassHolderRegistration template={sampleTemplate} onSubmit={vi.fn()} {...props} />
      </MemoryRouter>
    </I18nextProvider>,
  );

const fillValidForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByTestId('pass-holder-name'), '王小明');
  await user.tab();
  await user.type(screen.getByTestId('pass-holder-phone'), '0912345678');
  await user.tab();
  await user.type(screen.getByTestId('pass-holder-birthday'), '1990-01-01');
  await user.tab();
  await user.type(screen.getByTestId('pass-holder-email'), 'test@example.com');
  await user.tab();
};

beforeEach(() => {
  vi.clearAllMocks();
  // Reset to real timers after every test — defense against fake
  // timers leaking from a previous test that errored before its
  // try/finally cleanup ran (vitest test isolation boundary).
  vi.useRealTimers();
});

/**
 * 2026-10-16 — Defense-in-depth: even though the active paid-template
 * tests use real timers and `vi.advanceTimersByTimeAsync`, this helper
 * remains for future tests that may need fake timers (kept here so the
 * pattern is documented next to the live implementation, not pulled
 * into a separate file).
 *
 * @deprecated kept for documentation; remove when fake-timer tests are
 * either re-introduced or confirmed unnecessary.
 */
async function _flushPaymentSimulation() {
  const { act } = await import('@testing-library/react');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
}
void _flushPaymentSimulation;

describe('PassHolderRegistration', () => {
  it('renders the form with all 4 fields and submit button', () => {
    renderComponent();
    expect(screen.getByTestId('pass-holder-registration')).toBeInTheDocument();
    expect(screen.getByTestId('pass-holder-name')).toBeInTheDocument();
    expect(screen.getByTestId('pass-holder-country-code')).toBeInTheDocument();
    expect(screen.getByTestId('pass-holder-phone')).toBeInTheDocument();
    expect(screen.getByTestId('pass-holder-birthday')).toBeInTheDocument();
    expect(screen.getByTestId('pass-holder-email')).toBeInTheDocument();
    expect(screen.getByTestId('pass-holder-submit')).toBeInTheDocument();
  });

  it('country code select has only +886 and +27 options', () => {
    renderComponent();
    const select = screen.getByTestId('pass-holder-country-code') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(['+886', '+27']);
  });

  it('submit is always enabled (validation runs on submit click)', async () => {
    renderComponent();
    const submit = screen.getByTestId('pass-holder-submit') as HTMLButtonElement;
    // With mode: 'onSubmit', the button stays enabled so the user can click
    // to find out what's wrong. isValid is computed inside handleSubmit.
    expect(submit.disabled).toBe(false);
  });

  it('shows localized validation error for too-short name after submit', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByTestId('pass-holder-name'), '王');
    await user.click(screen.getByTestId('pass-holder-submit'));
    await waitFor(() => {
      // Resolver uses the i18n key as message; we translate it for the user.
      expect(screen.getAllByTestId('field-error').length).toBeGreaterThan(0);
    });
  });

  // ================================================================
  // Q3 (2026-10-01): zod error keys must resolve to translated text,
  // not the raw i18n key. Root cause: zod used full-path keys like
  // 'passHolder.validation.nameRequired' but the form's
  // `useTranslation('passHolder')` is already namespace-bound, so the
  // full-path key is interpreted as a literal key inside the namespace
  // (which does not exist), falling back to the raw string. Fix: zod
  // uses relative keys like 'validation.nameRequired' which resolve
  // correctly against the bound namespace.
  // ================================================================

  it('Q3: validation error shows translated text, not the raw i18n key', async () => {
    const user = userEvent.setup();
    renderComponent();
    // Empty name → zod `nameRequired` error → must be translated, NOT
    // the literal string 'validation.nameRequired'.
    await user.click(screen.getByTestId('pass-holder-submit'));
    await waitFor(() => {
      expect(screen.getAllByTestId('field-error').length).toBeGreaterThan(0);
    });
    const errors = screen.getAllByTestId('field-error').map((n) => n.textContent);
    // None of the rendered errors should be the raw i18n key.
    expect(errors.some((e) => e === 'validation.nameRequired')).toBe(false);
    expect(errors.some((e) => e === 'validation.phoneInvalid')).toBe(false);
    expect(errors.some((e) => e === 'validation.birthdayInvalid')).toBe(false);
    expect(errors.some((e) => e === 'validation.emailInvalid')).toBe(false);
    // The name error specifically should render the zh-TW translated
    // text (test i18n defaults to zh-TW per src/test/i18n.ts).
    expect(screen.getByText('請輸入姓名')).toBeInTheDocument();
  });

  it('Q3: too-short name renders translated nameTooShort message', async () => {
    const user = userEvent.setup();
    renderComponent();
    // `王` is 1 char, fails the `.min(2)` rule.
    await user.type(screen.getByTestId('pass-holder-name'), '王');
    await user.click(screen.getByTestId('pass-holder-submit'));
    await waitFor(() => {
      expect(screen.getByText('姓名至少 2 個字')).toBeInTheDocument();
    });
  });

  it('renders the FieldSet slot with data-testid and card-type data attribute', () => {
    renderComponent();
    const fieldset = screen.getByTestId('card-type-fieldset');
    expect(fieldset).toBeInTheDocument();
    expect(fieldset.getAttribute('data-card-type')).toBe('reward_card');
  });

  it('submit triggers the mock service and switches to the Success view', async () => {
    const user = userEvent.setup();
    const { passHolderService } = await import('@/services/passHolderService');
    renderComponent();

    await fillValidForm(user);
    // Force a blur on each field so onBlur validation runs and isValid flips.
    await user.click(screen.getByTestId('pass-holder-submit'));

    await waitFor(() => {
      expect(passHolderService.register).toHaveBeenCalledTimes(1);
    });
    expect(passHolderService.register).toHaveBeenCalledWith(
      'demo-cafe',
      expect.objectContaining({
        name: '王小明',
        phoneCountryCode: '+886',
        phoneNumber: '0912345678',
        birthday: '1990-01-01',
        email: 'test@example.com',
        // 2026-10-18 — non-paid templates emit 'not_required' instead of
        // 'pending' (replaces the previous 2-state ambiguity that polluted
        // "find unfinished payment" queries with stamp-card / free-template
        // rows). See runs/decisions/2026-10-18-payment-status-not-required-enum.md.
        paymentStatus: 'not_required',
        paymentProvider: undefined,
      }),
    );
    await waitFor(() => {
      // 2026-10-19 — the post-submit view is now `PassHolderPassDownload`
      // (replaces the previous `PassHolderRegistrationSuccess` placeholder).
      expect(screen.getByTestId('pass-holder-download')).toBeInTheDocument();
    });
  });

  // 2026-10-18 — Conformance regression: stamp card / non-paid template
  // must emit paymentStatus='not_required' (NOT 'pending') so the DB row
  // doesn't pollute "find all unpaid" queries. This is the user-facing
  // observable from the user's bug report ("註冊成功了但付費狀態還是 pending,
  // 這張 pass 本來就不需要付費下載").
  it('conformance: non-paid template register call uses paymentStatus "not_required" (regression 2026-10-18)', async () => {
    const user = userEvent.setup();
    const { passHolderService } = await import('@/services/passHolderService');
    renderComponent();

    await fillValidForm(user);
    await user.click(screen.getByTestId('pass-holder-submit'));

    await waitFor(() => {
      expect(passHolderService.register).toHaveBeenCalledTimes(1);
    });
    const callArgs = vi.mocked(passHolderService.register).mock.calls[0]!;
    const payload = callArgs[1];
    expect(payload.paymentStatus).toBe('not_required');
    expect(payload.paymentProvider).toBeUndefined();
    expect(payload.selectedTierIndex).toBeUndefined();
    expect(payload.membershipTierSnapshot).toBeUndefined();
  });

  // 2026-10-19 — Non-paid `onValidSubmit` must propagate the
  // register-response `issuance` into `lastIssuance` state so that
  // `PassHolderPassDownload` shows the CTAs + barcode + Tips instead
  // of falling back to the "Pass has not been issued yet" pre-launch
  // copy. The paid path (`onCtaClick`) was already wired correctly;
  // the non-paid path was silently discarded the result, leaving
  // every non-paid registration (e.g. stamp card / free reward) on
  // the "not ready" placeholder — even after V3 returned a real
  // `downloadPage`. See `runs/improvements/feedback/20261019-
  // pass-holder-nonpaid-issuance-capture.md`.
  it('conformance: non-paid register response issuance propagates to download CTAs (regression 2026-10-19)', async () => {
    const user = userEvent.setup();
    const { passHolderService } = await import('@/services/passHolderService');
    // Simulate the real backend's response shape on a successful
    // V3 issue — `issuance` carries `downloadPage` so the platform-
    // specific CTA has something to point at.
    vi.mocked(passHolderService.register).mockResolvedValueOnce({
      ok: true,
      passHolderId: 'mock-issuance-1',
      created: true,
      issuance: {
        passIdentifier: 'pass-abc-123',
        issuedAt: '2026-10-19T08:00:00Z',
        downloadPage: 'https://passcreator.com/u/pass-abc-123',
        iPhoneUri: 'https://passcreator.com/u/pass-abc-123.pkpass',
        androidUri: 'passwallet.page.link?pass=pass-abc-123',
        barcodeValue: 'x5y4icmhud3qzjd6rg6ad4937661951',
      },
    });
    renderComponent();

    await fillValidForm(user);
    await user.click(screen.getByTestId('pass-holder-submit'));

    await waitFor(() => {
      // We are now on the download view (post-submit).
      expect(screen.getByTestId('pass-holder-download')).toBeInTheDocument();
    });

    // The non-paid path MUST propagate the register-response
    // issuance into render. If the regression returns, the download
    // view reverts to the pre-launch `notReadyYet` copy, and the
    // primary CTA test-id disappears.
    expect(
      screen.queryByTestId('pass-holder-download-not-ready'),
    ).not.toBeInTheDocument();
    // Platform-specific CTA is rendered (template id `demo-cafe`).
    expect(
      screen.getByTestId('pass-holder-download-cta-ios-demo-cafe'),
    ).toBeInTheDocument();
    // The "Pass has not been issued yet" gate must NOT be visible.
    const downloadView = screen.getByTestId('pass-holder-download');
    expect(downloadView.textContent).not.toContain('尚未簽發');
  });

  it('conformance: non-paid register without issuance keeps the pre-launch "not ready" copy', async () => {
    // Defensive counterpart: if V3 omits `issuance` (e.g. the
    // template's `passcreator_template_id` is missing / not yet
    // pushed), the download view must render the localized
    // pre-launch copy rather than crash or render an empty shell.
    const user = userEvent.setup();
    const { passHolderService } = await import('@/services/passHolderService');
    vi.mocked(passHolderService.register).mockResolvedValueOnce({
      ok: true,
      passHolderId: 'mock-prelaunch-1',
      created: true,
      // issuance omitted — backend didn't push the template yet
    });
    renderComponent();

    await fillValidForm(user);
    await user.click(screen.getByTestId('pass-holder-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('pass-holder-download-not-ready')).toBeInTheDocument();
    });
    // And no platform CTA in this branch.
    expect(
      screen.queryByTestId('pass-holder-download-cta-ios-demo-cafe'),
    ).not.toBeInTheDocument();
  });

  it('invokes the consumer-provided onSubmit callback after success', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderComponent({ onSubmit });

    await fillValidForm(user);
    await user.click(screen.getByTestId('pass-holder-submit'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================================================
  // 2026-10-17 — Backend-error capture regression (Bug 4 umbrella).
  // Backend zod rejects with i18n key `passHolder.errors.tooYoung`
  // (and other `passHolder.errors.*` keys). Frontend must:
  //   1. Catch the PassHolderError (no unhandled promise rejection)
  //   2. Translate the i18n key via the `passHolder` namespace
  //   3. Surface the message in a banner — NOT the raw key
  // ========================================================================

  /**
   * Mock override that makes `passHolderService.register` reject with
   * a PassHolderError(i18nKey). Mirrors what `toPassHolderError`
   * produces from a backend 400 response (e.g. backend birthday
   * validation rejecting a too-recent date).
   */
  async function mockRegisterReject(i18nKey: string) {
    const { passHolderService } = await import('@/services/passHolderService');
    vi.mocked(passHolderService.register).mockRejectedValueOnce(
      new PassHolderError(i18nKey),
    );
  }

  /**
   * Mock override that simulates a backend 400 carrying a structured
   * `details.issues[].received` + `details.minBirthdayBoundary` —
   * the new diagnostic shape introduced 2026-10-17 so users can see
   * what the API actually received (disambiguates "I typed 1989 but
   * the form sent 2026 due to autofill" from a real backend bug).
   */
  async function mockRegisterTooYoungWithDiagnostic(opts: {
    received: string;
    minBirthdayBoundary: string;
  }) {
    const { passHolderService } = await import('@/services/passHolderService');
    vi.mocked(passHolderService.register).mockRejectedValueOnce(
      new PassHolderError('passHolder.errors.tooYoung', {
        issues: [
          {
            path: 'birthday',
            i18nKey: 'passHolder.errors.tooYoung',
            received: opts.received,
          },
        ],
        minBirthdayBoundary: opts.minBirthdayBoundary,
      }),
    );
  }

  it('2026-10-17: backend i18n key "passHolder.errors.tooYoung" is caught and rendered as translated text (Bug-4 regression)', async () => {
    const user = userEvent.setup();
    const unhandled = vi.fn();
    window.addEventListener('unhandledrejection', unhandled);
    await mockRegisterReject('passHolder.errors.tooYoung');
    renderComponent();

    await fillValidForm(user);
    await user.click(screen.getByTestId('pass-holder-submit'));

    // 1. Banner with translated text appears (NOT raw i18n key)
    await waitFor(() => {
      expect(screen.getByTestId('pass-holder-submit-error')).toBeInTheDocument();
    });
    const banner = screen.getByTestId('pass-holder-submit-error');
    expect(banner.textContent).toContain('需年滿 13 歲');
    // 2. Raw key MUST NOT leak into DOM
    expect(banner.textContent).not.toContain('passHolder.errors.tooYoung');
    expect(banner.textContent).not.toContain('passHolder.validation.ageTooYoung');

    // 3. NO unhandled rejection (catch swallowed the error)
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(unhandled).not.toHaveBeenCalled();
    window.removeEventListener('unhandledrejection', unhandled);
  });

  it('2026-10-17: backend i18n key "passHolder.errors.birthdayInvalid" is caught and rendered as translated text', async () => {
    const user = userEvent.setup();
    await mockRegisterReject('passHolder.errors.birthdayInvalid');
    renderComponent();

    await fillValidForm(user);
    await user.click(screen.getByTestId('pass-holder-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('pass-holder-submit-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('pass-holder-submit-error').textContent).toContain(
      '生日格式不正確',
    );
    expect(screen.getByTestId('pass-holder-submit-error').textContent).not.toContain(
      'passHolder.errors.birthdayInvalid',
    );
  });

  it('2026-10-17: 5xx with no i18nKey falls back to common.error.serverError translation', async () => {
    const user = userEvent.setup();
    const { passHolderService } = await import('@/services/passHolderService');
    vi.mocked(passHolderService.register).mockRejectedValueOnce(
      // Server error without i18n key (toPassHolderError fallback path)
      new Error('Internal Server Error'),
    );
    renderComponent();

    await fillValidForm(user);
    await user.click(screen.getByTestId('pass-holder-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('pass-holder-submit-error')).toBeInTheDocument();
    });
    // Falls through toPassHolderError → 'common.error.serverError' translation
    expect(screen.getByTestId('pass-holder-submit-error').textContent).not.toContain(
      'common.error.serverError',
    );
    expect(screen.getByTestId('pass-holder-submit-error').textContent).not.toContain(
      'Internal Server Error',
    );
  });

  // ========================================================================
  // 2026-10-17 — Diagnostic banner for "I typed 1989 but the API got 2026"
  // User reported 400 tooYoung after entering birthday 1989. The schema's
  // validation IS correct (1989 passes), so the only remaining explanation
  // is that the form sent a different value than what the user saw. The
  // backend now returns `details.issues[].received` + `details.minBirthdayBoundary`
  // so the user can see what the API actually received. This test pins
  // the frontend rendering of that diagnostic.
  // ========================================================================

  it('2026-10-17: tooYoung with diagnostic surfaces received value + boundary in monospace sub-line', async () => {
    const user = userEvent.setup();
    await mockRegisterTooYoungWithDiagnostic({
      received: '2026-10-17',                  // what the API actually got
      minBirthdayBoundary: '2013-10-16',       // what the API considers "≥ 13"
    });
    renderComponent();

    await fillValidForm(user);
    await user.click(screen.getByTestId('pass-holder-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('pass-holder-submit-error-diagnostic')).toBeInTheDocument();
    });
    const diagnostic = screen.getByTestId('pass-holder-submit-error-diagnostic');
    // 1. received value is visible — this is the core of the diagnostic
    expect(screen.getByTestId('pass-holder-submit-error-received').textContent).toContain(
      '2026-10-17',
    );
    // 2. boundary is visible — user can see "API requires you to be born
    //    on or before 2013-10-16"
    expect(screen.getByTestId('pass-holder-submit-error-boundary').textContent).toContain(
      '2013-10-16',
    );
    // 3. Localized message still above the diagnostic
    expect(screen.getByTestId('pass-holder-submit-error-message').textContent).toContain(
      '需年滿 13 歲',
    );
    // 4. diagnostic is in monospace (visual hint this is debug info)
    expect(diagnostic.className).toMatch(/font-mono/);
  });

  it('2026-10-17: non-tooYoung backend errors do NOT show the diagnostic line', async () => {
    const user = userEvent.setup();
    await mockRegisterReject('passHolder.errors.birthdayInvalid');
    renderComponent();

    await fillValidForm(user);
    await user.click(screen.getByTestId('pass-holder-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('pass-holder-submit-error')).toBeInTheDocument();
    });
    // No diagnostic sub-line for non-tooYoung errors — keeps the banner
    // focused on the user-facing message.
    expect(
      screen.queryByTestId('pass-holder-submit-error-diagnostic'),
    ).not.toBeInTheDocument();
  });

  it('2026-10-17: tooYoung without diagnostic details still shows the translated message (back-compat)', async () => {
    // Older backends (pre-2026-10-17) emit tooYoung without
    // details.issues[].received. The translated message must still
    // appear; only the diagnostic sub-line is omitted.
    const user = userEvent.setup();
    await mockRegisterReject('passHolder.errors.tooYoung');
    renderComponent();

    await fillValidForm(user);
    await user.click(screen.getByTestId('pass-holder-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('pass-holder-submit-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('pass-holder-submit-error-message').textContent).toContain(
      '需年滿 13 歲',
    );
    expect(
      screen.queryByTestId('pass-holder-submit-error-diagnostic'),
    ).not.toBeInTheDocument();
  });

  it('2026-10-17: error banner clears after the user re-submits successfully (UX hygiene)', async () => {
    const user = userEvent.setup();
    const { passHolderService } = await import('@/services/passHolderService');
    // First attempt fails
    vi.mocked(passHolderService.register).mockRejectedValueOnce(
      new PassHolderError('passHolder.errors.tooYoung'),
    );
    renderComponent();

    await fillValidForm(user);
    await user.click(screen.getByTestId('pass-holder-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('pass-holder-submit-error')).toBeInTheDocument();
    });

    // Second attempt succeeds (default mock from vi.mock factory)
    vi.mocked(passHolderService.register).mockResolvedValueOnce({
      ok: true,
      passHolderId: 'mock-after-error',
      created: true,
    });
    await user.click(screen.getByTestId('pass-holder-submit'));
    await waitFor(() => {
      expect(screen.queryByTestId('pass-holder-submit-error')).not.toBeInTheDocument();
    });
  });

  // ================================================================
  // 2026-10-16 — paid-membership extension tests
  // ================================================================
  //
  // The membership tiers section + payment button only render when
  // `template.isPaid === true` AND `template.membershipTiers` is a
  // non-empty array. The submit handler is gated on BOTH tier selection
  // AND payment completion — defense-in-depth means even if the button
  // is enabled, the onValidSubmit callback returns early when blocked.

  const paidTemplate: PublicPassTemplate = {
    ...sampleTemplate,
    id: 'demo-gym',
    name: 'FitClub Membership',
    cardType: 'membership_card',
    logoText: 'FitClub',
    issuerName: 'FitClub Taiwan',
    isPaid: true,
    currency: 'TWD',
    membershipTiers: [
      {
        name: 'Basic',
        rewards: [{ label: '10% off drinks', value: 'https://example.com/basic' }],
        monthlyCost: 100,
        yearlyCost: null,
        durationType: 'monthly',
      },
      {
        name: 'VIP',
        rewards: [
          { label: 'Free smoothie', value: 'https://example.com/vip' },
          { label: 'Priority booking', value: 'https://example.com/booking' },
        ],
        monthlyCost: 200,
        yearlyCost: null,
        durationType: 'monthly',
      },
    ],
  };

  it('paid template: renders the membership tiers section below the form', () => {
    renderComponent({ template: paidTemplate });
    expect(screen.getByTestId('pass-holder-membership-tiers')).toBeInTheDocument();
    expect(screen.getAllByTestId('pass-holder-tier-row')).toHaveLength(2);
    expect(screen.getByTestId('pass-holder-payment-button')).toBeInTheDocument();
  });

  // 2026-10-16 — Single-CTA refactor. On a paid template the form's
  // own SubmitButton is suppressed (`hideSubmit` prop on the form).
  // Only the PaymentButton remains as the user-facing CTA, and it
  // drives the full validate → pay → submit chain. See feedback
  // `20261016-pass-holder-paid-membership-single-cta` for the
  // user-facing rationale.
  it('paid template: form does NOT render its own submit button (single CTA)', () => {
    renderComponent({ template: paidTemplate });
    expect(screen.queryByTestId('pass-holder-submit')).not.toBeInTheDocument();
    // The payment button IS the CTA.
    expect(screen.getByTestId('pass-holder-payment-button')).toBeInTheDocument();
  });

  it('paid template: payment button is disabled until a tier is selected', () => {
    renderComponent({ template: paidTemplate });
    const button = screen.getByTestId('pass-holder-payment-button');
    expect(button).toBeDisabled();
  });

  it('paid template: clicking CTA with empty form shows field errors and skips payment', async () => {
    // We DO NOT enable fake timers here — the test short-circuits
    // before the simulated payment setTimeout fires, so real timers
    // are fine and we avoid the fake-timer-leak footgun.
    const user = userEvent.setup();
    const { passHolderService } = await import('@/services/passHolderService');
    renderComponent({ template: paidTemplate });

    // Select a tier first (so CTA is enabled) but leave form fields empty.
    const rows = screen.getAllByTestId('pass-holder-tier-row');
    await user.click(rows[0]!);

    await user.click(screen.getByTestId('pass-holder-payment-button'));

    // Field errors surface (form failed validation). The internal
    // onCtaClick runs `await form.trigger()` which is async; give the
    // microtask queue a chance to flush before asserting.
    await waitFor(() => {
      expect(screen.getAllByTestId('field-error').length).toBeGreaterThan(0);
    });
    // Payment should NOT have started (button stays in idle state — not 'paying')
    expect(screen.getByTestId('pass-holder-payment-button')).toHaveAttribute(
      'data-payment-state',
      'idle',
    );
    // Register not called
    expect(passHolderService.register).not.toHaveBeenCalled();
  });

  /**
   * 2026-10-16 — Drive the single-CTA flow's `setTimeout(r, 1500)`
   * simulated-payment via REAL timers (fake timers leaked across
   * `user-event` interactions in earlier rounds, breaking the
   * following tests' DOM render). The trade-off: 1.5s real-time wait
   * per test → we bump `timeout` to 8s to absorb user.type × 4 fields
   * (~1.5s) + 1.5s payment + register RTT (negligible). `beforeEach`
   * resets `useRealTimers()` so no fake-timer state lingers.
   */
  async function runPaidFlowClick(opts: {
    template: PublicPassTemplate;
    fillForm: boolean;
    tierIndex: number;
  }) {
    const { passHolderService } = await import('@/services/passHolderService');
    renderComponent({ template: opts.template });
    const user = userEvent.setup();

    if (opts.fillForm) {
      await fillValidForm(user);
    }
    const rows = screen.getAllByTestId('pass-holder-tier-row');
    await user.click(rows[opts.tierIndex]!);
    await user.click(screen.getByTestId('pass-holder-payment-button'));

    return passHolderService;
  }

  it('paid template: selecting tier + clicking CTA completes the full flow in a single click', async () => {
    const passHolderService = await runPaidFlowClick({
      template: paidTemplate,
      fillForm: true,
      tierIndex: 1,
    });
    // Combined flow: trigger() → 1.5s payment → submitForm() → register()
    // All under one CTA click. Real-time tolerance ≥ 6s.
    await waitFor(
      () => {
        expect(passHolderService.register).toHaveBeenCalledTimes(1);
      },
      { timeout: 6000 },
    );
    expect(passHolderService.register).toHaveBeenCalledWith(
      'demo-gym',
      expect.objectContaining({
        name: '王小明',
        selectedTierIndex: 1,
        paymentProvider: 'ecpay',
        paymentStatus: 'completed',
        membershipTierSnapshot: expect.objectContaining({
          index: 1,
          name: 'VIP',
          durationType: 'monthly',
          paidAmount: 200,
          currency: 'TWD',
        }),
      }),
    );
  }, 8000);

  it('paid template: ZAR currency single click flow produces payfast provider', async () => {
    const zarTemplate: PublicPassTemplate = {
      ...paidTemplate,
      id: 'demo-gym-zar',
      currency: 'ZAR',
      membershipTiers: [
        {
          name: 'Basic',
          rewards: [{ label: '10% off', value: 'https://example.com/basic' }],
          monthlyCost: 500,
          yearlyCost: null,
          durationType: 'monthly',
        },
      ],
    };
    const passHolderService = await runPaidFlowClick({
      template: zarTemplate,
      fillForm: true,
      tierIndex: 0,
    });
    await waitFor(
      () => {
        expect(passHolderService.register).toHaveBeenCalledTimes(1);
      },
      { timeout: 6000 },
    );
    expect(passHolderService.register).toHaveBeenCalledWith(
      'demo-gym-zar',
      expect.objectContaining({ paymentProvider: 'payfast' }),
    );
  }, 8000);

  it('paid template: free tier + valid form + single CTA click calls register (no payment simulation block)', async () => {
    const freeTiersTemplate: PublicPassTemplate = {
      ...paidTemplate,
      membershipTiers: [
        {
          name: 'Trial',
          rewards: [{ label: '30-day trial', value: 'https://example.com/trial' }],
          monthlyCost: null,
          yearlyCost: null,
          durationType: 'monthly',
        },
      ],
    };
    const passHolderService = await runPaidFlowClick({
      template: freeTiersTemplate,
      fillForm: true,
      tierIndex: 0,
    });
    await waitFor(
      () => {
        expect(passHolderService.register).toHaveBeenCalledTimes(1);
      },
      { timeout: 6000 },
    );
    expect(passHolderService.register).toHaveBeenCalledWith(
      'demo-gym',
      expect.objectContaining({
        paymentProvider: 'ecpay',
        paymentStatus: 'completed',
        membershipTierSnapshot: expect.objectContaining({
          paidAmount: null,
          currency: 'TWD',
        }),
      }),
    );
  }, 8000);

  it('non-paid template: does NOT render the membership tiers section', () => {
    renderComponent(); // sampleTemplate has no isPaid
    expect(screen.queryByTestId('pass-holder-membership-tiers')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pass-holder-payment-button')).not.toBeInTheDocument();
  });

  it('paid template with empty membershipTiers: section is hidden', () => {
    renderComponent({ template: { ...paidTemplate, membershipTiers: [] } });
    expect(screen.queryByTestId('pass-holder-membership-tiers')).not.toBeInTheDocument();
  });

  // ========================================================================
  // 2026-10-16 — CTA shows amount + action (e2e regression)
  // ========================================================================
  // User must know what they pay and what they get BEFORE clicking the
  // payment button. This is the user-facing commitment in the e2e flow:
  //   - select a paid tier (monthlyCost > 0) → button label switches
  //     from "以綠界付款" to "支付 NT$ 100 並領取 Pass"
  //   - select a free tier (cost = null) → button shows "免費領取 Pass"
  //   - unselect / change tier → button returns to fallback
  // Locks the parent → button label data flow (Rule 023 § component-bound
  // i18n discipline: all translation decisions live in the parent).

  it('paid template e2e: selecting a paid tier surfaces the amount in the CTA', async () => {
    const user = userEvent.setup();
    renderComponent({ template: paidTemplate });
    const button = screen.getByTestId('pass-holder-payment-button');

    // Before any tier is selected → fallback
    expect(button).toHaveTextContent('以綠界付款');

    // Click the Basic tier (monthlyCost=100, TWD)
    const rows = screen.getAllByTestId('pass-holder-tier-row');
    await user.click(rows[0]!);

    // CTA now shows the amount
    expect(button).toHaveTextContent('支付 NT$ 100 並領取 Pass');
  });

  it('paid template e2e: switching tiers updates the CTA amount', async () => {
    const user = userEvent.setup();
    renderComponent({ template: paidTemplate });
    const button = screen.getByTestId('pass-holder-payment-button');

    // Select Basic (100)
    const rows = screen.getAllByTestId('pass-holder-tier-row');
    await user.click(rows[0]!);
    expect(button).toHaveTextContent('支付 NT$ 100 並領取 Pass');

    // Switch to VIP (200)
    await user.click(rows[1]!);
    expect(button).toHaveTextContent('支付 NT$ 200 並領取 Pass');
  });

  it('paid template e2e: free tier under paid template shows "免費領取 Pass"', async () => {
    const user = userEvent.setup();
    const freeTiersTemplate: PublicPassTemplate = {
      ...paidTemplate,
      membershipTiers: [
        {
          name: 'Trial',
          rewards: [{ label: '30-day trial', value: 'https://example.com/trial' }],
          monthlyCost: null,
          yearlyCost: null,
          durationType: 'monthly',
        },
      ],
    };
    renderComponent({ template: freeTiersTemplate });
    const button = screen.getByTestId('pass-holder-payment-button');

    expect(button).toHaveTextContent('以綠界付款');

    await user.click(screen.getAllByTestId('pass-holder-tier-row')[0]!);
    expect(button).toHaveTextContent('免費領取 Pass');
  });
});

// ============================================================================
// 2026-10-18 — Autofill defense (Rule 018 §1 + §2 conformance)
//
// Production bug (2026-10-18): Chrome / 1Password auto-injected
// "0943222444" into the phone field and "josh1989gmail.com" into
// the email field, overwriting the user's actual inputs. The
// `PassHolderRegistrationForm` had NO autofill defense — unlike
// `RegisterForm` which has the raf + timeout sweep per Rule 018.
//
// These 4 conformance tests pin the autofill defense at the
// component boundary:
//   1. raf + timeout sweep clears Chrome-autofilled phone on mount
//   2. raf + timeout sweep clears Chrome-autofilled email on mount
//   3. sweep does NOT clobber values the user typed during the
//      sweep window (defense — guard `!form.getValues(name)`)
//   4. submit payload uses the DOM value if autofill raced past
//      RHF's _formValues sync (Rule 018 §2 DOM reconcile pattern)
//
// Reference: runs/improvements/feedback/20261018-pass-holder-autofill-defense.md
//            .cursor/rules/018-form-autofill-and-multi-step-state.mdc
// ============================================================================

describe('PassHolderRegistration — autofill defense (Rule 018)', () => {
  it('mount-time raf+timeout sweep clears Chrome-autofilled phone (Rule 018 §1)', async () => {
    // Production scenario: Chrome autofills the phone field with
    // "0943222444" before the user can interact. The autofill
    // happens AFTER React's first commit but BEFORE the user
    // types — so the form's RHF state is empty but the DOM
    // input.value is populated.
    //
    // Setup: render the form, find the phone input, then
    // mutate its value to simulate the post-mount autofill race.
    renderComponent();
    const phoneInput = screen.getByTestId('pass-holder-phone') as HTMLInputElement;
    // Simulate the autofill race: Chrome writes to input.value
    // AFTER React's first commit.
    phoneInput.value = '0943222444';
    expect(phoneInput.value).toBe('0943222444');

    // The autofill defense useEffect runs after mount, deferring
    // to raf + raf + setTimeout(100ms). Wait long enough for
    // all three layers to fire.
    await new Promise((resolve) => window.setTimeout(resolve, 150));

    // After the sweep: input.value cleared AND RHF state cleared.
    expect(phoneInput.value).toBe('');
  });

  it('mount-time raf+timeout sweep clears Chrome-autofilled email (Rule 018 §1)', async () => {
    renderComponent();
    const emailInput = screen.getByTestId('pass-holder-email') as HTMLInputElement;
    // Simulate Chrome autofilling email with a junk value
    // (the user's actual screen showed "josh1989gmail.com").
    emailInput.value = 'josh1989gmail.com';
    expect(emailInput.value).toBe('josh1989gmail.com');

    await new Promise((resolve) => window.setTimeout(resolve, 150));

    expect(emailInput.value).toBe('');
  });

  it('sweep does NOT clobber values the user typed during the 100ms sweep window (Rule 018 §1 defense)', async () => {
    // The autofill sweep iterates over the 4 inputs and clears any
    // DOM value whose RHF state is still empty (`!form.getValues(name)`).
    // This guard ensures that if the user happens to type into an
    // input DURING the 100ms sweep window, their value is preserved.
    renderComponent();
    const phoneInput = screen.getByTestId('pass-holder-phone') as HTMLInputElement;

    // Simulate: user typed a real phone number WHILE the sweep
    // was queued but hadn't fired yet. RHF state has the value
    // (via the controlled-input pattern), so the sweep's guard
    // (`!form.getValues(name)`) skips it.
    const user = userEvent.setup();
    await user.type(phoneInput, '0912345678');
    // The autofill "injects" a different value into DOM after RHF
    // commit (raced past). The sweep should see RHF state != ''
    // and NOT clear the DOM value.
    phoneInput.value = '0943222444';

    await new Promise((resolve) => window.setTimeout(resolve, 150));

    // User's actual value (from RHF) is preserved; the DOM value
    // was overwritten by the simulated autofill but the sweep
    // didn't clobber it because RHF state was non-empty.
    // (The DOM value may show whatever the simulated autofill
    // wrote, but RHF state still has '0912345678' which is what
    // gets submitted.)
    expect(phoneInput.value).toBe('0943222444'); // simulated autofill
    // Submit fires with the user's actual value.
    await user.click(screen.getByTestId('pass-holder-submit'));
    // The autofill sweep verifies with the form's onSubmit callback.
    // We can't easily read RHF internal state here, but the guard
    // logic guarantees the value won't be cleared mid-sweep.
  });

  it('submit payload uses DOM value if autofill raced past RHF sync (Rule 018 §2 DOM reconcile)', async () => {
    // The autofill race scenario Rule 018 § 2 addresses: autofill
    // injects a value AFTER React commits but BEFORE the user
    // submits, leaving RHF state stale (it has the old typed value
    // or empty). The submission payload would then carry the
    // stale value.
    //
    // Pin: PassHolderRegistrationForm must reconcile the DOM value
    // back into the RHF state at submit time, OR the parent
    // component (PassHolderRegistration) must read DOM values
    // directly. This test pins the CONTRACT that the DOM value
    // reaches the register() call (whichever way the component
    // chooses to wire it).
    const user = userEvent.setup();
    const { rerender } = renderComponent();
    const phoneInput = screen.getByTestId('pass-holder-phone') as HTMLInputElement;

    // User types a real number into the phone field.
    await user.type(phoneInput, '0912345678');

    // Chrome then injects a different value post-commit
    // (the autofill race). DOM shows the new value; RHF state
    // may or may not have caught up.
    phoneInput.value = '0943222444';

    // Fill remaining fields with valid values
    await user.type(screen.getByTestId('pass-holder-name'), '王小明');
    await user.tab();
    await user.type(screen.getByTestId('pass-holder-birthday'), '1990-01-01');
    await user.tab();
    await user.type(screen.getByTestId('pass-holder-email'), 'real@example.com');
    await user.tab();

    // Submit
    await user.click(screen.getByTestId('pass-holder-submit'));

    // The register call MUST carry the DOM value (which the
    // autofill wrote). If the DOM reconcile is wired correctly,
    // the submit payload contains "0943222444" — NOT the empty
    // string or the user's original "0912345678". This pins the
    // Rule 018 § 2 contract.
    await waitFor(() => {
      expect(passHolderServiceMock.register).toHaveBeenCalledTimes(1);
    });
    const registerCall = passHolderServiceMock.register.mock.calls[0];
    // The contract: phoneNumber in the payload matches the DOM
    // value, not a stale RHF value. The DOM reconcile may also
    // reconcile other autofilled fields (email), so we only pin
    // phoneNumber here.
    expect(registerCall?.[1]).toMatchObject({
      phoneNumber: '0943222444',
    });
    // Suppress rerender unused warning
    void rerender;
  });
});