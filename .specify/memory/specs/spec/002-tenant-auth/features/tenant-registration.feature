Feature: 店家註冊(兩步驟表單 + 自動登入)

  作為一個尚未有帳號的台灣店家負責人
  我想要在 `/register` 頁分兩步驟填寫店家資料與帳號資料
  以便在送出後自動登入並進入我的店家 dashboard

  Background:
    Given 我尚未登入

  Scenario: 正常兩步驟註冊流程(自動登入導向 /app/dashboard)
    Given 我在 "register" 頁
    And 我在 Step 1 「店家資訊」填入合法的店家資料(聯絡人姓名、市話、公司地址、統一編號或 "0"、公司名稱、發票地址)
    And 我點 "下一步" 按鈕
    Then 我進入 Step 2 「帳號資訊」
    And 我在 Step 2 填入合法的 Email 與密碼
    When 我點 "建立帳號" 按鈕
    Then 系統顯示 "註冊成功" 訊息
    And 瀏覽器導向 "/app/dashboard"
    And 我看到 "即將推出" 的 dashboard 殼頁
    And Header 出現 "登出" 連結

  Scenario: 統一編號接受 "0"(個人戶/工作室)
    Given 我在 Step 1 「店家資訊」表單
    When 我在 "taxId" 欄位填入 "0"
    Then 該欄位通過驗證(無錯誤訊息)

  Scenario: 統一編號接受 8 碼數字(公司戶)
    Given 我在 Step 1 「店家資機」表單
    When 我在 "taxId" 欄位填入 "12345678"
    Then 該欄位通過驗證(無錯誤訊息)

  Scenario: 統一編號拒絕非 "0" 且非 8 碼數字的字串
    Given 我在 Step 1 「店家資訊」表單
    When 我在 "taxId" 欄位填入 "ABC12345"
    Then 該欄位顯示錯誤訊息 "統一編號格式錯誤"

  Scenario: Email 已被使用時擋下註冊(不透露帳號存在)
    Given 系統中已存在帳號 "[email protected]"
    And 我在 "register" 頁的 Step 2
    When 我在 "email" 欄位填入 "[email protected]"
    And 我點 "建立帳號" 按鈕
    Then 系統顯示 "此 Email 已被使用" 訊息
    And 我沒有被導向 dashboard
    And 我仍在 "/register" 頁

  Scenario: 已登入的使用者回到 /register 頁會被自動導向
    Given 我已登入為 tenant 角色
    When 我導航到 "/register"
    Then 瀏覽器自動導向 "/app/dashboard"

  Scenario: 密碼與確認密碼不一致
    Given 我在 Step 2 「帳號資訊」表單
    When 我在 "password" 欄位填入 "Password123"
    And 我在 "confirmPassword" 欄位填入 "Password999"
    And 我點 "建立帳號" 按鈕
    Then 系統顯示錯誤訊息 "兩次密碼不一致"

  Scenario: 重複送出表單會被鎖定(連點兩次 Submit 只送一次)
    Given 我在 Step 2 表單填入完整合法資料
    When 我連點 "建立帳號" 按鈕兩次
    Then 表單 submit 只被觸發一次
    And 我看到 loading 狀態直到導向完成
