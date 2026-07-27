Feature: 角色分流(tenant → /app/dashboard、admin → /admin/dashboard)

  為了區分前台使用者與後台管理員
  登入後系統依 JWT role claim 自動選擇正確的 dashboard 路徑
  且 cross-role 存取必須被拒絕

  Scenario: tenant 登入後落到 /app/dashboard
    Given 我是 tenant 角色
    And 我登入成功
    Then 瀏覽器導向 "/app/dashboard"
    And 我看到 tenant 的 "即將推出" 殼頁

  Scenario: admin 登入後落到 /admin/dashboard
    Given 我是 admin 角色
    And 我登入成功
    Then 瀏覽器導向 "/admin/dashboard"
    And 我看到 admin 的 "即將推出" 殼頁

  Scenario: tenant 嘗試手動輸入 /admin/dashboard 被拒絕
    Given 我已登入為 tenant 角色
    When 我手動在網址列輸入 "/admin/dashboard"
    Then 系統拒絕存取(顯示 403 或自動導回 "/app/dashboard")

  Scenario: tenant 嘗試 GET /api/auth/me 的 role claim 是 tenant
    Given 我已登入為 tenant 角色
    When 我呼叫 GET "/api/auth/me"
    Then 回應 payload 的 role 是 "tenant"
    And 回應 payload 的 email 與我登入用的一致

  Scenario: 未登入存取受保護頁面跳回 /login
    Given 我尚未登入
    When 我導航到 "/app/dashboard"
    Then 瀏覽器導向 "/login"

  Scenario: 已過期 session 嘗試存取受保護頁面跳回 /login
    Given 我之前登入過但 access token 已過期
    And refresh token 也被伺服器撤銷
    When 我導航到 "/app/dashboard"
    Then 系統嘗試 refresh 失敗
    And 瀏覽器導向 "/login"
    And 顯示 "您的 session 已過期,請重新登入" 訊息
