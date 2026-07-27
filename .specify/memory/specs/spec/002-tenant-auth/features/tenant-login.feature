Feature: 店家登入(Email + 密碼 → 角色導向 dashboard)

  作為一個已註冊的店家負責人
  我想要在 `/login` 頁輸入 email 與密碼
  以便登入後進到我的店家 dashboard

  Scenario: tenant 帳號登入成功導向 /app/dashboard
    Given 系統中已存在 tenant 帳號 "[email protected]" 密碼 "CorrectPass1"
    And 我在 "login" 頁
    When 我在 "email" 欄位填入 "[email protected]"
    And 我在 "password" 欄位填入 "CorrectPass1"
    And 我點 "登入" 按鈕
    Then 瀏覽器導向 "/app/dashboard"

  Scenario: admin 帳號登入成功導向 /admin/dashboard
    Given 系統中已存在 admin 帳號 "[email protected]" 密碼 "AdminPass1"
    And 我在 "login" 頁
    When 我在 "email" 欄位填入 "[email protected]"
    And 我在 "password" 欄位填入 "AdminPass1"
    And 我點 "登入" 按鈕
    Then 瀏覽器導向 "/admin/dashboard"

  Scenario: 錯誤密碼顯示通用錯誤訊息(不透露帳號是否存在)
    Given 系統中已存在 "[email protected]"
    And 我在 "login" 頁
    When 我在 "email" 欄位填入 "[email protected]"
    And 我在 "password" 欄位填入 "WrongPassword"
    And 我點 "登入" 按鈕
    Then 系統顯示 "帳號或密碼錯誤" 訊息
    And 訊息 **不**包含 "此帳號不存在" 或 "密碼不正確" 等明確訊息

  Scenario: 登入失敗後可以立刻再嘗試(尚未到 3 次)
    Given 我對 "[email protected]" 連續 2 次輸入錯誤密碼
    And 我在 "login" 頁
    When 我在 "email" 欄位填入 "[email protected]"
    And 我在 "password" 欄位填入 "CorrectPass1"
    And 我點 "登入" 按鈕
    Then 我成功登入(累計失敗次數歸零)

  Scenario: 已登入的 tenant 回到 /login 會被自動導向
    Given 我已登入為 tenant 角色
    When 我導航到 "/login"
    Then 瀏覽器自動導向 "/app/dashboard"

  Scenario: 點 Header 「登出」連結會清 session 並回到 /login
    Given 我已登入為 tenant 角色
    And 我看到 Header 有 "登出" 連結
    When 我點 Header 的 "登出" 連結
    Then 我被導向 "/login"
    And Header 改顯示 "登入" 連結

  Scenario: 登入頁載入時若 session 已過期 → 顯示已登出訊息並 form 可用
    Given 我的 refresh token 已過期
    And 我在 "login" 頁
    Then 系統顯示 "您的 session 已過期,請重新登入"
    And 我可以正常輸入帳號密碼
