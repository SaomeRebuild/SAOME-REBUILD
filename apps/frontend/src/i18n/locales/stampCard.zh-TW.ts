/**
 * Stamp Card namespace — Traditional Chinese.
 *
 * @see apps/frontend/src/components/business/stampCard/StampCardImageComposer/ for consumers.
 *
 * Component-bound namespace per Rule 023 § 元件化原則. 跨 feature 重用
 * (CardBuilder Step 3 / 未來 Scanner) 時只攜帶這個 namespace, 不污染
 * `cardEditor` / `cardBuilder`.
 *
 * 翻譯紀律:
 *   - 嚴格全中文。例外僅限於 whitelist 縮寫 (PNG / API / URL / Step)。
 *   - "0.png" 是檔名（file system 上的字串識別子），不是英文單字。
 *     規則 § 翻譯書寫紀律 允許保留原形：技術性檔名屬於借用字。
 *   - 數字 "15" / "16" 是檔名編號的一部分，與 "cap"（上限）等量詞不同。
 *     上限類詞彙已翻為中文「上限」/「最高」。
 */
export default {
  composer: {
    title: '預覽並上傳 0.png',
    description: '將目前的印章格子設定渲染成空模板圖, 上傳到 R2。後續掃碼器會用同一個模組生成 1.png 到 15.png。',
    trigger: {
      previewSaveAsZero: '預覽並儲存 0.png',
    },
    status: {
      idle: '尚未上傳',
      composing: '正在組圖…',
      uploading: '正在上傳…',
      saved: '0.png 已上傳',
      error: '上傳失敗, 請重試',
    },
    cap: {
      warning: '這個模板的印章總數 {{count}} 超過上限 15, 16.png 以後不會再生成。',
    },
    gridTransparent: '格線永遠是透明的 (0% 透明度), Passcreator 推送時不會看到格線邊框。',
    disabled: {
      noTemplate: '請先儲存模板 (Step 8 才能產生 0.png)。',
    },
  },
};