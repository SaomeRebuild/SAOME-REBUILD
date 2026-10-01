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

vi.mock('@/services/passHolderService', () => ({
  passHolderService: {
    register: vi.fn().mockResolvedValue({ ok: true, passHolderId: 'mock-123' }),
  },
}));

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
});

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
      }),
    );
    await waitFor(() => {
      expect(screen.getByTestId('pass-holder-success')).toBeInTheDocument();
    });
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
});