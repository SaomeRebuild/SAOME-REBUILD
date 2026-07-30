/**
 * RegisterForm — mobile field wiring (2026-07-31).
 *
 * Asserts:
 *  1. Step 1 renders a Mobile (手機號碼) input bounded by phoneCity.
 *  2. The mobile input has autoComplete="tel" so Chrome picks the
 *     correct semantic field and rule 018's autofill guard applies.
 *  3. Form-level schema normalize: a bare Taiwan 09xxxxxxxx input
 *     is preserved as-is through RHF (the schema's z.preprocess only
 *     runs on submit, not on every change); we verify the Field is
 *     present, optional (no asterisk required marker), and that a
 *     '09xxxxxxxx' value flows through.
 *
 * Does NOT assert backend integration — backend tests already cover
 * that path.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import RegisterForm from './RegisterForm';

vi.mock('@/services/authService', () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
    refresh: vi.fn().mockRejectedValue(new Error('no refresh cookie')),
    me: vi.fn().mockRejectedValue(new Error('no me')),
    logout: vi.fn(),
  },
}));

function renderRegister() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <RegisterForm />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('RegisterForm — mobile field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders a mobile input on Step 1 below the office-phone field', () => {
    renderRegister();
    const mobileInput = screen.getByRole('textbox', { name: 'register.mobile' });
    expect(mobileInput).toBeInTheDocument();
    // Should not be marked required (mobile is optional).
    expect(mobileInput).not.toBeRequired();
  });

  it('mobile input has autoComplete="tel"', () => {
    renderRegister();
    const mobileInput = screen.getByRole('textbox', { name: 'register.mobile' });
    expect(mobileInput.getAttribute('autocomplete')).toBe('tel');
  });

  it('user can type a bare Taiwan 09xxxxxxxx mobile number', async () => {
    const user = userEvent.setup();
    renderRegister();
    const mobileInput = screen.getByRole('textbox', { name: 'register.mobile' });
    await user.type(mobileInput, '0912345678');
    expect(mobileInput).toHaveValue('0912345678');
  });

  it('user can type an international +E.164 mobile number', async () => {
    const user = userEvent.setup();
    renderRegister();
    const mobileInput = screen.getByRole('textbox', { name: 'register.mobile' });
    await user.type(mobileInput, '+886912345678');
    expect(mobileInput).toHaveValue('+886912345678');
  });

  it('leaving mobile blank does not block Step 1 → Step 2 progression', async () => {
    const user = userEvent.setup();
    renderRegister();

    // Fill all required Step 1 fields except mobile. The Field component
    // associates the label via htmlFor, but in jsdom the label text is the
    // i18n key (no provider wraps the test). We query the inputs by their
    // registered `name` attribute instead.
    await user.type(screen.getByRole('textbox', { name: 'register.contactName' }), '王小明');
    await user.type(screen.getByRole('textbox', { name: 'register.phoneCity' }), '02-1234-5678');
    await user.type(screen.getByRole('textbox', { name: 'register.address' }), '台北市信義區信義路 1 號');
    await user.type(screen.getByRole('textbox', { name: 'register.taxId' }), '12345678');
    await user.type(screen.getByRole('textbox', { name: 'register.name' }), '王小明工作室');
    await user.type(screen.getByRole('textbox', { name: 'register.invoiceAddress' }), '台北市信義區信義路 1 號');

    await user.click(screen.getByRole('button', { name: 'register.next' }));

    // Step 2 should now show email field.
    expect(await screen.findByRole('textbox', { name: 'register.accountEmail' })).toBeInTheDocument();
  });
});
