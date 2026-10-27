
import "server-only";

import { performance } from "node:perf_hooks";

export async function measurePerformance<T>(
  label: string,
  operation: () => Promise<T>
): Promise<T> {
  if (process.env.PERF_DEBUG !== "true") {
    return operation();
  }

  const startedAt = performance.now();

  try {
    return await operation();
  } finally {
    const duration = Math.round(
      performance.now() - startedAt
    );

    console.info(`[Performance] ${label}: ${duration}ms`);
  }
}
