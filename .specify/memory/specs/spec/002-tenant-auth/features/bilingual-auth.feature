Feature: 雙語使用者介面(zh-TW 預設 + 即時切換 en)

  作為一個 SAOME 的使用者(店家或訪客)
  我想要切換介面語系(繁中 ↔ English)
  以便表單 label、placeholder、按鈕文字、錯誤訊息都即時翻譯

  Scenario: 預設顯示繁體中文
    Given 我首次進入 "login" 頁
    Then 表單 title 是 "登入"
    And email 欄位 placeholder 是 "請輸入 Email"
    And 密碼欄位 placeholder 是 "請輸入密碼"
    And 「登入」按鈕文字是 "登入"

  Scenario: 切換到 English 後所有文字變英文
    Given 我在 "login" 頁(預設 zh-TW)
    When 我點語言切換器選擇 "English"
    Then 表單 title 變 "Sign in"
    And email 欄位 placeholder 變 "Email address"
    And 密碼欄位 placeholder 變 "Password"
    And 「登入」按鈕文字變 "Sign in"

  Scenario: 切換語系後錯誤訊息也立即翻譯
    Given 我已切換到 English
    And 我在 "login" 頁輸入錯誤密碼並送出
    Then 系統顯示英文錯誤訊息 "Invalid email or password"

  Scenario: 切換後重新整理頁面保留語系偏好
    Given 我在 "login" 頁切換到 English
    And 我重新整理頁面
    Then 頁面仍顯示英文介面
    And 表單 title 仍是 "Sign in"

  Scenario: 在 /register 頁切換語系涵蓋兩步驟
    Given 我在 "register" 頁(預設 zh-TW)
    And 我切換到 English
    Then Step 1 表單所有 label 變英文
    When 我進入 Step 2
    Then Step 2 表單所有 label 也是英文

  Scenario: 語系切換在 dashboard 殼頁也生效
    Given 我已登入並在 "/app/dashboard"
    When 我在 Header 切換語系到 English
    Then 殼頁的 "即將推出" 文案變 "Coming soon"
