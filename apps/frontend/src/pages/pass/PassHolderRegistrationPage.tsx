/**
 * PassHolderRegistrationPage — public "Get Pass" page entry.
 *
 * Responsibilities:
 *   1. Pull `templateId` from the URL (`/pass/:templateId`)
 *   2. Fetch the public template via `passHolderService.getTemplate`
 *   3. Render <PassHolderShell> + <PassHolderRegistration> on success
 *   4. Render error / loading / 404 placeholders without throwing
 *
 * URL semantics — React Router v6 pattern syntax (Q1 fix, 2026-10-01):
 *   The route in App.tsx is `/pass/:templateId`. The leading `:` is the
 *   React Router pattern marker, NOT part of the URL. A visitor opens:
 *     - `/pass/<uuid>`     → matches, renders the form
 *     - `/pass/:<uuid>`    → literal colon prefix does NOT match any
 *                            route → falls through to the not-found view
 *   This page intentionally has NO `:templateId` literal in its own
 *   routing — it consumes `useParams<{ templateId: string }>()` and
 *   only treats undefined as "not found".
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PassHolderShell } from '@/components/layout/PassHolderShell';
import { PassHolderRegistration } from '@/components/business/pass/PassHolderRegistration';
import { ComingSoonCard } from '@/components/ui/feedback/ComingSoonCard';
import { passHolderService, PassHolderError } from '@/services/passHolderService';
import { applyPageLanguage } from '@/i18n';
import type { PublicPassTemplate } from '@saome/shared/types/passHolder';

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; template: PublicPassTemplate }
  | { status: 'not-found' }
  | { status: 'error'; i18nKey: string };

export function PassHolderRegistrationPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const { t } = useTranslation('passHolder');
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    if (!templateId) {
      setState({ status: 'not-found' });
      return () => {
        cancelled = true;
      };
    }
    setState({ status: 'loading' });
    passHolderService
      .getTemplate(templateId)
      .then((template) => {
        if (!cancelled) {
          // Q2 fix (2026-10-01): apply the template's language for the
          // duration of the page view. Does NOT persist to localStorage —
          // see `applyPageLanguage` for rationale.
          applyPageLanguage(template.language);
          setState({ status: 'loaded', template });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof PassHolderError && err.i18nKey === 'passHolder.errors.templateNotFound') {
          setState({ status: 'not-found' });
          return;
        }
        setState({ status: 'error', i18nKey: 'errors.networkError' });
      });
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  if (state.status === 'loading' || state.status === 'loaded') {
    return (
      <PassHolderShell template={state.status === 'loaded' ? state.template : null}>
        {state.status === 'loaded' ? (
          <PassHolderRegistration
            template={state.template}
            onSubmit={() => {
              /* submission succeeded; Success view is rendered inside */
            }}
          />
        ) : (
          <LoadingSkeleton />
        )}
      </PassHolderShell>
    );
  }

  if (state.status === 'not-found') {
    return (
      <PassHolderShell template={null}>
        <ComingSoonCard
          title={t('errors.templateNotFound')}
          description={t('subtitle', { issuerName: '' })}
        />
      </PassHolderShell>
    );
  }

  // state.status === 'error' — use a relative key for the passHolder
  // namespace; `t()` resolves relative keys against the bound namespace.
  return (
    <PassHolderShell template={null}>
      <ComingSoonCard
        title={t(state.i18nKey)}
        description={t('subtitle', { issuerName: '' })}
      />
    </PassHolderShell>
  );
}

/** Minimal skeleton — neutral placeholder so layout does not jump. */
function LoadingSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-screen-sm flex-col gap-4"
      data-testid="pass-holder-loading"
      aria-busy="true"
    >
      <div
        className="h-8 w-3/4 animate-pulse rounded"
        style={{ backgroundColor: 'var(--color-muted)' }}
      />
      <div
        className="h-4 w-1/2 animate-pulse rounded"
        style={{ backgroundColor: 'var(--color-muted)' }}
      />
      <div className="flex flex-col gap-3 pt-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded"
            style={{ backgroundColor: 'var(--color-muted)' }}
          />
        ))}
      </div>
    </div>
  );
}