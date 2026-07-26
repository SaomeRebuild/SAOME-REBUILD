# language: zh-TW

Feature: 產品詳細頁
  作為訪客
  我要查看 SAOME 產品的完整功能介紹
  以便了解系統提供的所有功能

  Scenario: 1. Hero section 正確渲染
    Given 訪客進入 /product 頁面
    Then 顯示 hero 標題 "商品細節"
    And 顯示 hero 副標題 "深入了解 SAOME 的完整功能"

  Scenario: 2. SectionHeader 正確渲染標題和副標題
    Given 訪客進入 /product 頁面
    Then 每個 section 的標題正確顯示
    And 每個 section 的副標題正確顯示

  Scenario: 3. FeatureCard 正確渲染 icon、標題、說明
    Given 訪客進入 /product 頁面
    Then 每個 FeatureCard 有 emoji icon
    And 每個 FeatureCard 有標題
    And 每個 FeatureCard 有說明文字

  Scenario: 4. 8 個 section 內容正確
    Given 訪客進入 /product 頁面
    Then 顯示「1. 產品介紹」section（含表單、CRM、查重功能）
    And 顯示「2. 卡片客製化」section
    And 顯示「3. 高效互動」section（含 6 個功能）
    And 顯示「4. 卡片建置器」section
    And 顯示「5. 行銷方案」section
    And 顯示「6. 訊息分享」section
    And 顯示「7. 電子信箱」section
    And 顯示「8. 離線模式」section

  Scenario: 5. CTA 按鈕連結至 /register
    Given 訪客進入 /product 頁面
    Then 主要 CTA 按鈕連結至 /register

  Scenario: 6. CTA 按鈕連結至 /pricing/compare
    Given 訪客進入 /product 頁面
    Then 次要 CTA 按鈕連結至 /pricing/compare

  Scenario: 7. i18n：預設語言為繁體中文
    Given 訪客進入 /product 頁面
    Then 所有 UI 文字為繁體中文
