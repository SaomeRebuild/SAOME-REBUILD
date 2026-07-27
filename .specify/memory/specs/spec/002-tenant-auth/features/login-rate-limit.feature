Feature: 登入失敗鎖定保護(前端 UX + 後端事實,3 次失敗/10 分鐘)

  為了防止暴力破解
  任何 email 在連續 3 次登入失敗後,系統應鎖定該帳號 10 分鐘
  鎖定期間不論密碼是否正確都拒絕登入,並顯示剩餘時間

  Scenario: 連續 3 次失敗後鎖定 10 分鐘
    Given 我對 "[email protected]" 連續 2 次輸入錯誤密碼
    And 我在 "login" 頁
    When 我在 "email" 欄位填入 "[email protected]"
    And 我在 "password" 欄位填入 "WrongPassword3"
    And 我點 "登入" 按鈕(第 3 次失敗)
    Then 系統回傳 lockout 狀態(剩餘時間 ≥ 590 秒)
    And 系統顯示 "帳號已被暫時鎖定" 訊息
    And 我看到倒數計時 "剩 09:43"
    And 表單 submit 按鈕被鎖定,我無法再次送出

  Scenario: 鎖定期間即使輸入正確密碼也被拒絕
    Given "[email protected]" 已被鎖定 1 分鐘
    And 我在 "login" 頁
    When 我在 "email" 欄位填入 "[email protected]"
    And 我在 "password" 欄位填入 "CorrectPass1"
    And 我點 "登入" 按鈕
    Then 系統回傳 lockout 狀態(剩餘時間 ≈ 540 秒)
    And 我仍未登入

  Scenario: 10 分鐘後鎖定自動解除,可以成功登入
    Given "[email protected]" 已被鎖定 10 分鐘
    And 我在 "login" 頁
    When 我在 "email" 欄位填入 "[email protected]"
    And 我在 "password" 欄位填入 "CorrectPass1"
    And 我點 "登入" 按鈕
    Then 我成功登入
    And 系統不再回傳 lockout 狀態

  Scenario: 後端事實 lock 強於前端 UX lock(繞過前端仍被鎖)
    Given "[email protected]" 已連續 3 次失敗(後端累計)
    And 我已經清空 localStorage 與 cookie(繞過前端 UX lock)
    When 我直接呼叫後端 "/api/auth/login" 帶入正確密碼
    Then 後端回傳 HTTP 423 Locked
    And 回應 payload 包含 lockout 剩餘時間

  Scenario: 鎖定期間前端倒數計時每秒更新
    Given "[email protected]" 已被鎖定
    And 我在 "login" 頁
    Then 我看到倒數計時
    When 我等待 2 秒
    Then 倒數計時的值下降 2 秒

  Scenario: 累計失敗次數在成功登入後歸零
    Given 我對 "[email protected]" 連續 2 次輸入錯誤密碼
    And 我在 "login" 頁
    When 我在 "email" 欄位填入 "[email protected]"
    And 我在 "password" 欄位填入 "CorrectPass1"
    And 我點 "登入" 按鈕
    Then 我成功登入
    And 後端 login_attempts 表中該 email 的失敗計數歸零
