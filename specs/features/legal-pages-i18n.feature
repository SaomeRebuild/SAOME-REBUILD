Feature: Legal Pages Full i18n
  為法律頁面（GDPR / Privacy / Terms）提供繁中＋英文的完整 i18n 支援。
  切換語言後不應殘留任何 zh-TW 字串。

  Background:
    Given i18n 預設語言為 zh-TW
    And 使用者位於任一法律頁面

  Scenario: 1. 預設繁中 → GDPR 頁面標題正確
    Given 預設語言為 zh-TW
    When 使用者進入 /gdpr
    Then 頁面標題顯示「資料處理協議 (DPA)」
    And 副標題顯示「本協議是《主服務協議》（MSA）的附件。」

  Scenario: 2. 預設繁中 → Privacy 頁面標題正確
    Given 預設語言為 zh-TW
    When 使用者進入 /privacy
    Then 頁面標題顯示「隱私權政策」
    And 第一個 section 標題包含「聯絡資訊與總則」

  Scenario: 3. 預設繁中 → Terms 頁面標題正確
    Given 預設語言為 zh-TW
    When 使用者進入 /terms
    Then 頁面標題顯示「服務條款」
    And 第一個 section 標題包含「服務範圍與授權」

  Scenario: 4. 切英文 → GDPR 頁面標題翻成英文
    Given 使用者位於 /gdpr
    When 使用者點擊 EN 切換語系
    Then 頁面標題顯示「Data Processing Agreement (DPA)」
    And 副標題顯示「This agreement is an annex to the Master Service Agreement (MSA).」

  Scenario: 5. 切英文 → Privacy 頁面標題翻成英文
    Given 使用者位於 /privacy
    When 使用者點擊 EN 切換語系
    Then 頁面標題顯示「Privacy Policy」
    And 第一個 section 標題包含「Contact Information」

  Scenario: 6. 切英文 → GDPR 表格內容（controller / processor）顯示英文
    Given 使用者位於 /gdpr
    When 使用者點擊 EN 切換語系
    Then A 段表格顯示「Controller」與「Processor」標籤
    And B 段表格表頭顯示「Item」與「Description」

  Scenario: 7. 切英文 → Privacy 表格內容（data types）顯示英文
    Given 使用者位於 /privacy
    When 使用者點擊 EN 切換語系
    Then B 段表格表頭顯示「Data Type」、「Purpose」、「Legal Basis」
    And 表格至少有一列「Account and contact information」

  Scenario: 8. 切英文 → GDPR 段落標題（processingOnly / confidentiality / TOMS）顯示英文
    Given 使用者位於 /gdpr
    When 使用者點擊 EN 切換語系
    Then C 段顯示「Process only per instructions」標題
    And C 段顯示「Confidentiality」標題
    And C 段顯示「Information security measures (TOMS)」標題
    And C 段顯示「Sub-processors」標題
    And C 段顯示「Duty to assist」標題

  Scenario: 9. 切英文 → Privacy DSR 條列（Access / Rectification / Erasure...）顯示英文
    Given 使用者位於 /privacy
    When 使用者點擊 EN 切換語系
    Then E 段條列顯示「Access」標題
    And E 段條列顯示「Rectification」標題
    And E 段條列顯示「Erasure」標題
    And E 段條列顯示「Restriction」標題
    And E 段條列顯示「Data Portability」標題
    And E 段條列顯示「Objection」標題

  Scenario: 10. 切英文 → 沒有任何中文字串殘留
    Given 任一法律頁面（/gdpr /privacy /terms）
    When 使用者點擊 EN 切換語系
    Then 頁面 DOM 中不應包含任何中文字元（regex `[\u4e00-\u9fff]` 匹配為 0）
