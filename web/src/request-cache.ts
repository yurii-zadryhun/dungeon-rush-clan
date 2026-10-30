// Deduplicate concurrent reads and cache only short-lived non-sensitive view data.
const reads = new Map<string, { until: number; value: Promise<unknown> }>();

export function cachedRead<T>(key: string, load: () => Promise<T>): Promise<T> {
  const cached = reads.get(key);
  if (cached && cached.until > Date.now()) return cached.value as Promise<T>;
  const pending = load().catch((error) => {
    if (reads.get(key)?.value === pending) reads.delete(key);
    throw error;
  });
  reads.set(key, { until: Date.now() + 20_000, value: pending });
  return pending;
}

export function invalidateReads() {
  reads.clear();
}
