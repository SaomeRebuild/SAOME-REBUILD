export default {
  dashboardHeader: {
    logoAlt: 'SAOME',
    openMenu: '打開選單',
    closeMenu: '關閉選單',
    logout: '登出',
    /** B4 (2026-09-05): toast shown if /api/auth/logout request fails.
     *  Logout UX is non-blocking — the client still clears local tokens
     *  even when the server-side cookie-clear fails. */
    logoutError: '登出通知伺服器失敗，但已在本機清除您的登入狀態。',
    nav: {
      dashboard: '儀表板',
      members: '會員管理',
    },
  },
  dashboardFooter: {
    copyright: '© {{year}} SAOME. 保留所有權利。',
    privacy: '隱私權政策',
  },
  trialBanner: {
    title: '試用期',
    subtitle: '您的試用期將在 {{days}} 天後結束',
    cta: '立即升級',
  },
  toolbar: {
    home: '首頁',
    memberManagement: '會員管理',
    passManagement: '卡片管理',
    scanner: '掃碼系統',
    emailBlast: '郵件推播',
    analytics: '數據分析',
    settings: '設定',
  },
  tenantToolbar: {
    charts: '數據分析',
    cardBuilder: '卡片建置器',
    members: '會員管理',
    email: '電子郵件',
    billing: '帳單',
    settings: '設定',
    expandTooltip: '展開工具列',
    collapseTooltip: '收合工具列',
    openMenu: '開啟工具選單',
    closeMenu: '關閉工具選單',
    menuTitle: '工具選單',
  },
  toolPages: {
    charts: {
      title: '數據分析',
      description: '查看會員數據與趨勢分析。',
    },
    members: {
      title: '會員管理',
      description: '管理您的會員名單。',
    },
    email: {
      title: '電子郵件',
      description: '發送電子郵件給會員。',
    },
    billing: {
      title: '帳單',
      description: '查看與管理您的帳單。',
    },
    settings: {
      title: '設定',
      description: '調整您的帳戶設定。',
    },
  },
};
