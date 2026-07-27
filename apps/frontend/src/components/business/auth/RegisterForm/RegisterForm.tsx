/**
 * RegisterForm — multi-step tenant registration.
 *
 * Step 1: tenant info (contactName, phoneCity, address, taxId, companyName, invoiceAddress, mobile?, website?, businessEmail?).
 * Step 2: account info (email, password, confirmPassword).
 *
 * On success, AuthProvider stores session; useAuthRedirect handles navigation.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import {
  Field,
  PasswordField,
  SubmitButton,
  ErrorBanner,
  Stepper,
} from '@/components/ui';
import {
  tenantInfoSchema,
  accountInfoSchema,
  type TenantInfoInput,
  type AccountInfoInput,
  type RegistrationPayload,
} from '@saome/shared/schemas/auth';
import { useAuth } from '@/hooks';
import { SaomeApiError } from '@/services/httpClient';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';

const steps = [
  { label: 'Store info' },
  { label: 'Account' },
];

export function RegisterForm() {
  const { t } = useTranslation('auth');
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const tenantForm = useForm<TenantInfoInput>({
    resolver: zodResolver(tenantInfoSchema) as never,
    mode: 'onTouched',
    defaultValues: {
      invoiceAddress: '',
    },
  });

  const accountForm = useForm<AccountInfoInput>({
    resolver: zodResolver(accountInfoSchema) as never,
    mode: 'onTouched',
  });

  async function onStep1Submit(values: TenantInfoInput) {
    setServerError(null);
    sessionStorage.setItem('saome.reg.tenant', JSON.stringify(values));
    setStep(1);
  }

  async function onStep2Submit(values: AccountInfoInput) {
    setServerError(null);
    setSubmitting(true);
    try {
      const tenantJson = sessionStorage.getItem('saome.reg.tenant');
      if (!tenantJson) throw new Error('Missing tenant info');
      const tenant = JSON.parse(tenantJson) as TenantInfoInput;
      const payload: RegistrationPayload = {
        ...tenant,
        ...values,
        invoiceAddress: tenant.invoiceAddress || '',
      };
      await registerUser(payload);
      sessionStorage.removeItem('saome.reg.tenant');
      navigate(ROUTES.tenantDashboard, { replace: true });
    } catch (e) {
      if (e instanceof SaomeApiError) {
        if (e.code === 'CONFLICT') {
          setServerError(t('register.error.conflict'));
        } else if (e.code === 'VALIDATION_ERROR') {
          setServerError(t('register.error.validation'));
        } else {
          setServerError(t('register.error.unknown'));
        }
      } else {
        setServerError(t('register.error.unknown'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Stepper current={step} steps={steps} />
        {serverError ? <ErrorBanner message={serverError} /> : null}
        <form onSubmit={tenantForm.handleSubmit(onStep1Submit)} className="flex flex-col gap-4" noValidate>
          <Field label={t('register.contactName')} required error={tenantForm.formState.errors.contactName?.message ? t('register.error.required') : undefined}>
            <input {...tenantForm.register('contactName')} className={inputCls} />
          </Field>
          <Field label={t('register.phoneCity')} required error={tenantForm.formState.errors.phoneCity?.message ? t('register.error.required') : undefined}>
            <input {...tenantForm.register('phoneCity')} className={inputCls} />
          </Field>
          <Field label={t('register.address')} required error={tenantForm.formState.errors.address?.message ? t('register.error.required') : undefined}>
            <input {...tenantForm.register('address')} className={inputCls} />
          </Field>
          <Field label={t('register.taxId')} required description={t('register.taxIdHint')} error={tenantForm.formState.errors.taxId?.message ? t('register.error.required') : undefined}>
            <input {...tenantForm.register('taxId')} className={inputCls} />
          </Field>
          <Field label={t('register.name')} required error={tenantForm.formState.errors.companyName?.message ? t('register.error.required') : undefined}>
            <input {...tenantForm.register('companyName')} className={inputCls} />
          </Field>
          <Field label={t('register.invoiceAddress')} error={tenantForm.formState.errors.invoiceAddress?.message ? t('register.error.required') : undefined}>
            <input {...tenantForm.register('invoiceAddress')} className={inputCls} />
          </Field>
          <SubmitButton fullWidth>{t('register.next')}</SubmitButton>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Stepper current={step} steps={steps} />
      {serverError ? <ErrorBanner message={serverError} /> : null}
      <form onSubmit={accountForm.handleSubmit(onStep2Submit)} className="flex flex-col gap-4" noValidate>
        <Field label={t('register.accountEmail')} required error={accountForm.formState.errors.email?.message ? t('register.error.email') : undefined}>
          <input type="email" autoComplete="email" {...accountForm.register('email')} className={inputCls} />
        </Field>
        <PasswordField
          label={t('register.password')}
          autoComplete="new-password"
          required
          {...accountForm.register('password')}
          error={accountForm.formState.errors.password?.message ? t('register.error.password') : undefined}
        />
        <PasswordField
          label={t('register.confirmPassword')}
          autoComplete="new-password"
          required
          {...accountForm.register('confirmPassword')}
          error={accountForm.formState.errors.confirmPassword?.message ? t('register.error.passwordMismatch') : undefined}
        />
        <div className="flex gap-2">
          <button type="button" onClick={() => setStep(0)} className="min-h-[44px] flex-1 rounded border border-neutral-300 px-4 py-2 text-sm">
            {t('register.back')}
          </button>
          <SubmitButton loading={submitting} loadingText={t('register.submitting')} fullWidth>
            {t('register.submit')}
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  'min-h-[44px] w-full rounded border border-neutral-300 px-3 py-2 text-base focus:border-neutral-900 focus:outline-none';

export default RegisterForm;