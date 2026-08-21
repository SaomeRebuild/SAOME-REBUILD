/**
 * ConfirmAbandonDraftDialog — shown when user clicks "從頭建置" and a draft exists.
 *
 * Presents two options:
 * 1. Resume — jump to ?id=<draft.id> and load the existing draft
 * 2. Abandon — mark draft as abandoned, then create a new UUID
 *
 * UX: Explicit two-choice Dialog (Plan Option 1 + Soft Delete).
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TemplateDto } from '@saome/shared/schemas/card';

interface ConfirmAbandonDraftDialogProps {
  draft: TemplateDto | null;
  onResume: (draft: TemplateDto) => void;
  onDiscard: (draft: TemplateDto) => void;
  onCancel: () => void;
}

export function ConfirmAbandonDraftDialog({
  draft,
  onResume,
  onDiscard,
  onCancel,
}: ConfirmAbandonDraftDialogProps) {
  const { t } = useTranslation('confirmDraft');
  const [selectedAction, setSelectedAction] = useState<'resume' | 'discard'>('resume');
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Sync dialog open/close with draft prop
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (draft) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [draft]);

  // Close on backdrop click (native dialog backdrop)
  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      onCancel();
    }
  }

  function handleConfirm() {
    if (!draft) return;
    if (selectedAction === 'resume') {
      onResume(draft);
    } else {
      onDiscard(draft);
    }
  }

  if (!draft) return null;

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      style={{
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-card)',
        color: 'var(--color-card-foreground)',
        boxShadow: 'var(--shadow-soft)',
        padding: 0,
        backdropFilter: undefined,
      }}
      className="rounded-xl border border-border p-0 shadow-xl backdrop:bg-black/50"
    >
      <div
        className="flex w-[min(28rem,90vw)] flex-col p-8 gap-6"
        data-cursor-element-id="cursor-el-1"
      >
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h2
            className="text-xl font-semibold leading-tight"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {t('title')}
          </h2>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4">
          {/* Draft info card */}
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/20 px-5 py-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('draftLabel')}</span>
              <span
                className="max-w-[16rem] truncate font-medium"
                style={{ fontFamily: 'var(--font-family-body)' }}
              >
                {draft.name || t('unnamed')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('lastEditedAt')}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(draft.updatedAt).toLocaleString('zh-TW')}
              </span>
            </div>
          </div>

          {/* Radio group */}
          <div className="flex flex-col gap-3">
            {/* Resume option */}
            <label className="group relative flex cursor-pointer items-start gap-4 rounded-xl border border-border bg-card p-4 transition-transform transition-shadow duration-200 hover:scale-[1.03] hover:border-primary hover:shadow-[var(--shadow-lifted)] has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:shadow-[var(--shadow-glow)] has-[:checked]:scale-[1.01] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]">
              {/* Hidden radio — must be inside label for clicking to work; opacity-0 keeps it invisible */}
              <input
                type="radio"
                name="draft-action"
                value="resume"
                checked={selectedAction === 'resume'}
                onChange={() => setSelectedAction('resume')}
                className="absolute opacity-0 size-5 cursor-pointer top-4 left-4"
              />
              <div className="mt-0.5 flex items-center justify-center">
                <div
                  className="h-5 w-5 rounded-full border-2 border-border transition-colors duration-200 group-hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-primary"
                  style={{
                    borderColor: selectedAction === 'resume' ? 'var(--color-primary)' : undefined,
                    backgroundColor: selectedAction === 'resume' ? 'var(--color-primary)' : undefined,
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-semibold" style={{ fontFamily: 'var(--font-family-body)' }}>
                  {t('resumeLabel')}
                </span>
                <span className="text-xs text-muted-foreground">{t('resumeHint')}</span>
              </div>
            </label>

            {/* Discard option */}
            <label className="group relative flex cursor-pointer items-start gap-4 rounded-xl border border-border bg-card p-4 transition-transform transition-shadow duration-200 hover:scale-[1.03] hover:border-destructive hover:shadow-[var(--shadow-lifted)] has-[:checked]:border-destructive has-[:checked]:bg-destructive/5 has-[:checked]:scale-[1.01] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]">
              {/* Hidden radio — must be inside label for clicking to work */}
              <input
                type="radio"
                name="draft-action"
                value="discard"
                checked={selectedAction === 'discard'}
                onChange={() => setSelectedAction('discard')}
                className="absolute opacity-0 size-5 cursor-pointer top-4 left-4"
              />
              <div className="mt-0.5 flex items-center justify-center">
                <div
                  className="h-5 w-5 rounded-full border-2 border-border transition-colors duration-200 group-hover:border-destructive has-[:checked]:border-destructive has-[:checked]:bg-destructive"
                  style={{
                    borderColor: selectedAction === 'discard' ? 'var(--color-destructive)' : undefined,
                    backgroundColor: selectedAction === 'discard' ? 'var(--color-destructive)' : undefined,
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-destructive" style={{ fontFamily: 'var(--font-family-body)' }}>
                  {t('discardLabel')}
                </span>
                <span className="text-xs text-muted-foreground">{t('discardHint')}</span>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-border bg-card px-6 py-2.5 text-sm font-medium text-foreground transition-all duration-200 hover:scale-[1.03] hover:border-primary hover:text-primary active:scale-[0.97]"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary transition-all duration-200 hover:scale-[1.03] hover:shadow-[var(--shadow-glow)] active:scale-[0.97]"
          >
            {t('confirm')}
          </button>
        </div>
      </div>
    </dialog>
  );
}
