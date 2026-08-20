/**
 * BarcodePreview — 顯示 Barcode 預覽圖
 */

import { useTranslation } from 'react-i18next';
import { BARCODE_IMAGES, type BarcodeType } from '@saome/shared/schemas/cardBuilder';

interface BarcodePreviewProps {
  type: BarcodeType;
}

export function BarcodePreview({ type }: BarcodePreviewProps) {
  const { t } = useTranslation('cardEditor');

  return (
    <div className="mt-3 flex justify-center">
      <img
        src={BARCODE_IMAGES[type]}
        alt={type === 'qr_code' ? t('step2.barcode.qrCode') : t('step2.barcode.pdf417')}
        className={type === 'pdf_417' ? 'h-32 w-64 rounded-lg border bg-white object-contain' : 'h-32 w-32 rounded-lg border bg-white object-contain'}
      />
    </div>
  );
}
