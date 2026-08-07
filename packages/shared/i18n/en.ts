/**
 * English Translations
 *
 * @module shared/i18n/en
 */

export const en = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    submit: 'Submit',
    loading: 'Loading...',
    error: 'An error occurred',
    success: 'Success',
    back: 'Back',
    next: 'Next',
  },
  member: {
    title: 'Member',
    tier: {
      bronze: 'Bronze',
      silver: 'Silver',
      gold: 'Gold',
      ariaLabel: 'Member tier: {{tier}}',
    },
    register: 'Register',
    login: 'Login',
    logout: 'Logout',
    profile: 'Profile',
  },
  auth: {
    title: {
      login: 'Sign in',
      register: 'Create store account',
      comingSoon: 'Coming soon',
    },
    login: {
      emailLabel: 'Email',
      emailPlaceholder: 'Email address',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Password',
      submit: 'Sign in',
      submitting: 'Signing in...',
      errorInvalid: 'Invalid email or password',
      sessionExpired: 'Your session has expired, please sign in again',
      noAccountPrompt: 'No account yet?',
      registerCta: 'Register now',
      error: {
        tooManyAttempts: 'Too many attempts, please try again later',
        invalidCredentials: 'Invalid email or password',
        unknown: 'An unknown error occurred, please try again later',
        email: 'Please enter a valid email',
        required: 'This field is required',
      },
      locked: {
        message: 'Account locked. Try again in {{seconds}} seconds',
      },
    },
    register: {
      step1Title: 'Step 1: Store info',
      step2Title: 'Step 2: Account info',
      fields: {
        contactName: 'Contact name',
        phoneCity: 'Office phone',
        address: 'Business address',
        taxId: 'Tax ID (enter 0 if none)',
        companyName: 'Company / store name',
        invoiceAddress: 'Invoice mailing address',
        email: 'Login email',
        password: 'Password',
        confirmPassword: 'Confirm password',
        mobile: 'Mobile phone',
        website: 'Company / store website',
        businessEmail: 'Business contact email',
      },
      taxIdHint: 'If you have no tax ID, enter 0',
      submitStep1: 'Next',
      submitStep2: 'Create account',
      success: 'Account created',
    },
    lockout: {
      title: 'Account temporarily locked',
      body: 'Due to {{count}} consecutive failed login attempts, your account is temporarily locked. Please try again after the countdown.',
      remaining: '{{time}} remaining',
    },
    comingSoon: {
      appTitle: 'Store dashboard — coming soon',
      appBody: 'We are building the best store management tool for you. Stay tuned.',
      adminTitle: 'Admin dashboard — coming soon',
      adminBody: 'Admin dashboard under construction.',
    },
    languages: {
      'zh-TW': '繁體中文',
      en: 'English',
    },
  },
  pass: {
    title: 'Pass',
    tier: {
      basic: 'Basic',
      premium: 'Premium',
      enterprise: 'Enterprise',
    },
    active: 'Active',
    expired: 'Expired',
    purchase: 'Purchase Pass',
  },
  order: {
    title: 'Order',
    status: {
      pending: 'Pending',
      paid: 'Paid',
      shipped: 'Shipped',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    },
    create: 'Create Order',
  },
  validation: {
    required: 'This field is required',
    email: 'Please enter a valid email',
    minLength: 'At least {min} characters required',
    maxLength: 'Maximum {max} characters',
    passwordTooShort: 'Password must be at least 8 characters',
    passwordMismatch: 'Passwords do not match',
    taxIdInvalid: 'Tax ID format is invalid (use 0 or 8 digits)',
    lockedOut: 'Account temporarily locked, please try again later',
    emailAlreadyUsed: 'This email is already in use',
    networkError: 'Network error, please try again later',
  },
};

