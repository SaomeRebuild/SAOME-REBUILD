export default {
  dashboardHeader: {
    logoAlt: 'SAOME',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    logout: 'Sign out',
    /** B4 (2026-09-05): toast shown if /api/auth/logout request fails.
     *  Logout UX is non-blocking — the client still clears local tokens
     *  even when the server-side cookie-clear fails. */
    logoutError: 'Could not notify the server, but you are signed out locally.',
    nav: {
      dashboard: 'Dashboard',
      members: 'Members',
    },
  },
  dashboardFooter: {
    copyright: '© {{year}} SAOME. All rights reserved.',
    privacy: 'Privacy Policy',
  },
  trialBanner: {
    title: 'Trial',
    subtitle: 'Your trial will end in {{days}} days',
    cta: 'Upgrade Now',
  },
  toolbar: {
    home: 'Home',
    memberManagement: 'Members',
    passManagement: 'Cards',
    scanner: 'Scanner',
    emailBlast: 'Email',
    analytics: 'Analytics',
    settings: 'Settings',
  },
  tenantToolbar: {
    charts: 'Charts',
    cardBuilder: 'Card Builder',
    members: 'Members',
    email: 'Email',
    billing: 'Billing',
    settings: 'Settings',
    expandTooltip: 'Expand toolbar',
    collapseTooltip: 'Collapse toolbar',
    openMenu: 'Open tools menu',
    closeMenu: 'Close tools menu',
    menuTitle: 'Tools Menu',
  },
  toolPages: {
    charts: {
      title: 'Charts',
      description: 'View member data and trend analysis.',
    },
    members: {
      title: 'Members',
      description: 'Manage your member list.',
    },
    email: {
      title: 'Email',
      description: 'Send emails to members.',
    },
    billing: {
      title: 'Billing',
      description: 'View and manage your bills.',
    },
    settings: {
      title: 'Settings',
      description: 'Adjust your account settings.',
    },
  },
};
