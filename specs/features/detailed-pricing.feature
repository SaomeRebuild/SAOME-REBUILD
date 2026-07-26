# language: zh-TW

Feature: 詳細定價頁
  作為訪客
  我要比較不同方案的價格和功能
  以便選擇適合的方案

  Scenario: 1. 頁面標題正確渲染
    Given 訪客進入 /pricing/compare 頁面
    Then 顯示標題 "詳細定價"
    And 顯示副標題 "比較所有方案的功能"

  Scenario: 2. 預設顯示月付方案
    Given 訪客進入 /pricing/compare 頁面
    Then 三個方案價格為 $900、$1500、$2500

  Scenario: 3. 切換至年付方案
    Given 訪客進入 /pricing/compare 頁面
    When 點擊「年付」按鈕
    Then 三個方案價格為 $850、$1400、$2050

  Scenario: 4. 切換回月付方案
    Given 訪客進入 /pricing/compare 頁面
    When 點擊「月付」按鈕
    Then 三個方案價格為 $900、$1500、$2500

  Scenario: 5. Gold 方案顯示 Popular badge
    Given 訪客進入 /pricing/compare 頁面
    Then Gold 方案顯示 "Most Popular" badge

  Scenario: 6. 比較表格顯示所有功能
    Given 訪客進入 /pricing/compare 頁面
    Then 顯示「卡片功能」分類
    And 顯示「CRM 與會員管理」分類
    And 顯示「行銷工具」分類
    And 顯示「分享功能」分類
    And 顯示「線下模式」分類
    And 顯示「支援服務」分類

  Scenario: 7. CTA 按鈕連結至 /register
    Given 訪客進入 /pricing/compare 頁面
    Then 三個方案的 CTA 按鈕皆連結至 /register

  Scenario: 8. i18n：預設語言為繁體中文
    Given 訪客進入 /pricing/compare 頁面
    Then 所有 UI 文字為繁體中文
