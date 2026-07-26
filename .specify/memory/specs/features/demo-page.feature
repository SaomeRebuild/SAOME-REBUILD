# language: zh-TW

Feature: 演示頁
  作為訪客
  我要看到系統的演示內容
  以便了解系統運作方式

  Scenario: 1. 頁面標題正確渲染
    Given 訪客進入 /demo 頁面
    Then 顯示標題 "即將推出"
    And 顯示副標題 "演示影片即將上線，敬請期待"

  Scenario: 2. i18n：預設語言為繁體中文
    Given 訪客進入 /demo 頁面
    Then 所有 UI 文字為繁體中文
