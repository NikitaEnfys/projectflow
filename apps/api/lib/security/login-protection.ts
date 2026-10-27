import {
  checkRateLimit,
  clearRateLimit,
  recordRateLimitEvent,
} from "@/lib/security/rate-limit";

export const LOGIN_ACCOUNT_LIMIT =
  5;

export const LOGIN_ACCOUNT_WINDOW_MS =
  15 * 60 * 1000;

function accountKey(
  email: string,
) {
  return `login:account:${email
    .trim()
    .toLowerCase()}`;
}

export function checkLoginAccountLimit(
  email: string,
  now?: number,
) {
  return checkRateLimit({
    key: accountKey(email),
    limit:
      LOGIN_ACCOUNT_LIMIT,
    windowMs:
      LOGIN_ACCOUNT_WINDOW_MS,
    now,
  });
}

export function recordFailedLogin(
  email: string,
  now?: number,
) {
  recordRateLimitEvent({
    key: accountKey(email),
    windowMs:
      LOGIN_ACCOUNT_WINDOW_MS,
    now,
  });
}

export function clearLoginFailures(
  email: string,
) {
  clearRateLimit(
    accountKey(email),
  );
}
