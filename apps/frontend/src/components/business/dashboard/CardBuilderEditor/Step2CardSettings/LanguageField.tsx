/**
 * LanguageField — 卡片顯示語言 (zh-TW | en)
 * 2026-09-18: 新增 Step 2 欄位，決定卡片欄位送 Passcreator 時的語言
 * （Passcreator API 整合 deferred）。原生 <select> 兩選項。
 *
 * UI pattern aligned with Step 3 `FieldSelect` (leftField / rightField):
 *   - `appearance-none` 移除原生下拉箭頭
 *   - `pr-9` 為自訂 ChevronDown 留空間
 *   - `relative` wrapper 包 <select> + ChevronDown icon (absolute positioned)
 *   - `colorScheme: 'light'` (inline style) 強制 dropdown panel 用 light theme，
 *     避免深色頁面 → OS 開啟 dropdown 時變成白底白字（瀏覽器 native panel
 *     不受 CSS class 影響，只有 inline style `colorScheme` 可靠生效）
 *   - `color: '#000000'` (inline style on <option>) 雙重保險，少數瀏覽器
 *     在 light scheme 仍會把 option 文字渲染為 body 文字色
 *
 * Reference: apps/frontend/src/components/business/dashboard/CardBuilderEditor/
 *            Step3CardFields/index.tsx::FieldSelect (line ~73 SELECT_CLASS +
 *            line ~71 OPTION_STYLE + line ~197 ChevronDown).
 */
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

const SELECT_CLASS =
  'h-10 w-full appearance-none rounded-md border border-input bg-background ' +
  'px-3 py-2 pr-9 text-sm text-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const OPTION_STYLE = { color: '#000000' };

export function LanguageField() {
  const { t } = useTranslation('cardEditor');
  const language = useCardBuilderStore((s) => s.language);
  const setLanguage = useCardBuilderStore((s) => s.setLanguage);

  return (
    <div className="space-y-2">
      <label htmlFor="cardLanguage" className="text-sm font-medium">
        {t('step2.language.title')}
      </label>
      <div className="relative">
        <select
          id="cardLanguage"
          value={language}
          onChange={(e) => setLanguage(e.target.value as 'zh-TW' | 'en')}
          aria-label={t('step2.language.title')}
          style={{ colorScheme: 'light' }}
          className={SELECT_CLASS}
        >
          <option value="zh-TW" style={OPTION_STYLE}>
            {t('step2.language.zhTW')}
          </option>
          <option value="en" style={OPTION_STYLE}>
            {t('step2.language.en')}
          </option>
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
      <p className="text-xs text-muted-foreground">{t('step2.language.hint')}</p>
    </div>
  );
}
