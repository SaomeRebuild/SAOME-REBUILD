/**
 * In-memory auth token store — shared between AuthProvider and httpClient.
 *
 * Problem: httpClient needs access to the current accessToken for Bearer auth,
 * but the token lives in AuthProvider state. This module bridges the gap by
 * storing the token in a module-level variable that both can read/write.
 */

let _accessToken: string | null = null;

export function getAccessToken(): string | null {
  return _accessToken;
}

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}
