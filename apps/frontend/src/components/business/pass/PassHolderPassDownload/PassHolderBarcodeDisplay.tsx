/**
 * PassHolderBarcodeDisplay — inline barcode preview + hint copy.
 *
 * @module business/pass/PassHolderPassDownload/PassHolderBarcodeDisplay
 *
 * Renders the per-pass barcode value as a styled "card" so the user
 * can scan or visually confirm the value before opening the pass.
 * Apple/Google Wallet will also render the barcode when the pass is
 * added — this is a redundant but reassuring display.
 *
 * 2026-10-19 — initial version. The component does NOT generate a
 * real barcode image (QR / PDF417) — that would add a heavy
 * dependency. Future hardening can integrate `qrcode` (already in
 * the codebase per `runs/decisions/2026-10-04-qrcode-library-selection.md`).
 * Today, the value is shown as text for human verification + the
 * installed pass will render the visual barcode in Wallet.
 */

import { useTranslation } from 'react-i18next';
import { ScanLine } from 'lucide-react';

export interface PassHolderBarcodeDisplayProps {
  /** V3 `data.barcodeValue` — the per-pass barcode payload. */
  barcodeValue: string;
}

export function PassHolderBarcodeDisplay({
  barcodeValue,
}: PassHolderBarcodeDisplayProps) {
  const { t } = useTranslation('passHolder');

  return (
    <div
      className="flex flex-col gap-2 rounded-md border p-3 md:p-4"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-background)',
      }}
      data-testid="pass-holder-barcode-display"
    >
      <div className="flex items-center gap-2">
        <ScanLine
          size={18}
          style={{ color: 'var(--color-muted-foreground)' }}
          aria-hidden="true"
        />
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--color-foreground)' }}
        >
          {t('download.barcodeLabel')}
        </span>
      </div>
      {/* The barcode payload rendered as text. Truncate via overflow
          so a long barcode doesn't break the layout. */}
      <code
        className="block break-all rounded-sm p-2 font-mono text-sm"
        style={{
          backgroundColor: 'var(--color-muted)',
          color: 'var(--color-foreground)',
        }}
        data-testid="pass-holder-barcode-value"
      >
        {barcodeValue}
      </code>
      <p
        className="text-xs"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        {t('download.showBarcodeHint')}
      </p>
    </div>
  );
}