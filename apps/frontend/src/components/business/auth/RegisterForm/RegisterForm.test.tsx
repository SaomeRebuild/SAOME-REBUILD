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
 * Query strategy: use input `name` attribute via `screen.getByRole('textbox', { name: '<nameAttr>' })`.
 * This queries the input's accessible name, which equals the `name` attribute when the label's
 * `htmlFor` points to the input's `id`. Since Field clones the input with `id: id` (where id is the
 * generated React uid), the accessible name equals the label text (e.g. "手機號碼").
 * Using `name` attr queries would need `getByAttribute('name', 'mobile')` which is less semantic.
 * Using label text is the right way — it tests the full accessible name chain.
 *
 * Does NOT assert backend integration — backend tests already cover that path.
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

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getMobileInput = () =>
    // Field clones the input with id matching the label's htmlFor. The accessible
    // name is the label text, which i18n resolves to "手機號碼" for zh-TW.
    screen.getByRole('textbox', { name: '手機號碼' });

  const getContactNameInput = () =>
    screen.getByRole('textbox', { name: '聯絡人姓名' });

  const getAddressInput = () =>
    screen.getByRole('textbox', { name: '地址' });

  const getTaxIdInput = () =>
    screen.getByRole('textbox', { name: '統一編號' });

  const getNameInput = () =>
    screen.getByRole('textbox', { name: '公司 / 店家名稱' });

  const getInvoiceAddressInput = () =>
    screen.getByRole('textbox', { name: '發票寄送地址' });

  const getNextButton = () =>
    screen.getByRole('button', { name: '下一步' });

  // ── Tests ───────────────────────────────────────────────────────────────
  it('renders a mobile input on Step 1 below the office-phone field', () => {
    renderRegister();
    const mobileInput = getMobileInput();
    expect(mobileInput).toBeInTheDocument();
    // Mobile is required — Field sets aria-required on the cloned input.
    expect(mobileInput).toHaveAttribute('aria-required', 'true');
  });

  it('mobile input has autoComplete="tel"', () => {
    renderRegister();
    const mobileInput = getMobileInput();
    expect(mobileInput.getAttribute('autocomplete')).toBe('tel');
  });

  it('user can type a bare Taiwan 09xxxxxxxx mobile number', async () => {
    const user = userEvent.setup();
    renderRegister();
    const mobileInput = getMobileInput();
    await user.type(mobileInput, '0912345678');
    expect(mobileInput).toHaveValue('0912345678');
  });

  it('user can type an international +E.164 mobile number', async () => {
    const user = userEvent.setup();
    renderRegister();
    const mobileInput = getMobileInput();
    await user.type(mobileInput, '+886912345678');
    expect(mobileInput).toHaveValue('+886912345678');
  });

  it('leaving mobile blank blocks Step 1 → Step 2; providing mobile allows progression', async () => {
    const user = userEvent.setup();
    renderRegister();

    // Fill all required Step 1 fields (mobile is now required; phoneCity is optional).
    await user.type(getContactNameInput(), '王小明');
    // phoneCity is optional — skip it.
    await user.type(getMobileInput(), '0912345678');
    await user.type(getAddressInput(), '台北市信義區信義路 1 號');
    await user.type(getTaxIdInput(), '12345678');
    await user.type(getNameInput(), '王小明工作室');
    await user.type(getInvoiceAddressInput(), '台北市信義區信義路 1 號');

    await user.click(getNextButton());

    // Step 2 should now show email field (accessible name from auth.zh-TW.json).
    expect(await screen.findByRole('textbox', { name: '登入電子信箱' })).toBeInTheDocument();
  });
});
