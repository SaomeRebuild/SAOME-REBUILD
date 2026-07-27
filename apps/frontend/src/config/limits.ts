/**
 * Business limits — retry counts, lockout duration, etc.
 */

export const limits = {
  loginMaxAttempts: 3,
  loginLockoutSeconds: 10 * 60, // 10 minutes
  passwordMinLength: 8,
} as const;
