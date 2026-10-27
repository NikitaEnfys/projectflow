type RateLimitEntry = {
  timestamps: number[];
};

type RateLimitStore = Map<
  string,
  RateLimitEntry
>;

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
};

const globalForRateLimit =
  globalThis as typeof globalThis & {
    __projectflowRateLimitStore?:
      RateLimitStore;
  };

const store =
  globalForRateLimit
    .__projectflowRateLimitStore ??
  new Map<string, RateLimitEntry>();

globalForRateLimit
  .__projectflowRateLimitStore =
  store;

function activeTimestamps(
  key: string,
  windowMs: number,
  now: number,
) {
  const entry =
    store.get(key);

  if (!entry) {
    return [];
  }

  const threshold =
    now - windowMs;

  const active =
    entry.timestamps.filter(
      (timestamp) =>
        timestamp > threshold,
    );

  if (active.length === 0) {
    store.delete(key);
  } else if (
    active.length !==
    entry.timestamps.length
  ) {
    store.set(key, {
      timestamps: active,
    });
  }

  return active;
}

export function checkRateLimit({
  key,
  limit,
  windowMs,
  now = Date.now(),
}: RateLimitOptions): RateLimitResult {
  const active =
    activeTimestamps(
      key,
      windowMs,
      now,
    );

  return {
    allowed:
      active.length < limit,
    remaining:
      Math.max(
        0,
        limit - active.length,
      ),
  };
}

export function recordRateLimitEvent({
  key,
  windowMs,
  now = Date.now(),
}: Omit<
  RateLimitOptions,
  "limit"
>) {
  const active =
    activeTimestamps(
      key,
      windowMs,
      now,
    );

  active.push(now);

  store.set(key, {
    timestamps: active,
  });
}

export function consumeRateLimit(
  options: RateLimitOptions,
): RateLimitResult {
  const result =
    checkRateLimit(options);

  if (!result.allowed) {
    return result;
  }

  recordRateLimitEvent({
    key: options.key,
    windowMs:
      options.windowMs,
    now: options.now,
  });

  return {
    allowed: true,
    remaining:
      Math.max(
        0,
        result.remaining - 1,
      ),
  };
}

export function clearRateLimit(
  key: string,
) {
  store.delete(key);
}

export function resetRateLimitsForTests() {
  if (
    process.env.NODE_ENV !==
    "test"
  ) {
    throw new Error(
      "A rate limit store reset csak tesztkörnyezetben használható.",
    );
  }

  store.clear();
}
