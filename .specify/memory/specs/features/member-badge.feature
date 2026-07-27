Feature: 會員等級顯示元件

  作為 SAOME 會員系統的使用者
  我希望能看到自己的會員等級
  以便了解我的會員狀態

  Background:
    Given 我在會員資料頁面

  Scenario: 顯示金牌會員
    Given 我的會員等級是 "gold"
    When 頁面載入完成
    Then 我應該看到 "金牌" 文字
    And 我應該看到金牌圖示

  Scenario: 顯示銀牌會員
    Given 我的會員等級是 "silver"
    When 頁面載入完成
    Then 我應該看到 "銀牌" 文字
    And 我應該看到銀牌圖示

  Scenario: 顯示銅牌會員
    Given 我的會員等級是 "bronze"
    When 頁面載入完成
    Then 我應該看到 "銅牌" 文字
    And 我應該看到銅牌圖示

  Scenario: 切換等級
    Given 我的會員等級是 "bronze"
    When 我的等級升級為 "gold"
    Then 元件應該重新渲染為 "gold"
