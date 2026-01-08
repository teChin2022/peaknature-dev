/**
 * Performance Timing Utility
 * Measures execution time of async operations
 * Only logs in development mode
 */

const isDevelopment = process.env.NODE_ENV === 'development'

interface TimingResult<T> {
  result: T
  durationMs: number
}

/**
 * Measure execution time of an async function
 * @param label - Label for the timing log
 * @param fn - Async function to measure
 * @returns The result of the function and duration in ms
 */
export async function measure<T>(
  label: string,
  fn: () => Promise<T>
): Promise<TimingResult<T>> {
  const start = performance.now()
  const result = await fn()
  const durationMs = Math.round(performance.now() - start)
  
  if (isDevelopment) {
    const emoji = durationMs > 500 ? '🐌' : durationMs > 200 ? '⚠️' : '⚡'
    console.log(`[PERF] ${emoji} ${label}: ${durationMs}ms`)
  }
  
  return { result, durationMs }
}

/**
 * Measure multiple operations and log summary
 */
export async function measureAll<T extends Record<string, () => Promise<unknown>>>(
  operations: T
): Promise<{ results: { [K in keyof T]: Awaited<ReturnType<T[K]>> }; timings: { [K in keyof T]: number }; totalMs: number }> {
  const totalStart = performance.now()
  const results: Record<string, unknown> = {}
  const timings: Record<string, number> = {}
  
  // Run all operations in parallel
  const entries = Object.entries(operations)
  const promises = entries.map(async ([key, fn]) => {
    const start = performance.now()
    const result = await fn()
    const duration = Math.round(performance.now() - start)
    return { key, result, duration }
  })
  
  const settled = await Promise.all(promises)
  
  for (const { key, result, duration } of settled) {
    results[key] = result
    timings[key] = duration
  }
  
  const totalMs = Math.round(performance.now() - totalStart)
  
  if (isDevelopment) {
    console.log('[PERF] === Parallel Operations Summary ===')
    for (const [key, duration] of Object.entries(timings)) {
      const emoji = duration > 500 ? '🐌' : duration > 200 ? '⚠️' : '⚡'
      console.log(`[PERF]   ${emoji} ${key}: ${duration}ms`)
    }
    console.log(`[PERF] Total (parallel): ${totalMs}ms`)
  }
  
  return {
    results: results as { [K in keyof T]: Awaited<ReturnType<T[K]>> },
    timings: timings as { [K in keyof T]: number },
    totalMs
  }
}

/**
 * Simple timer for manual start/stop
 */
export function createTimer(label: string) {
  const start = performance.now()
  
  return {
    stop: () => {
      const durationMs = Math.round(performance.now() - start)
      if (isDevelopment) {
        const emoji = durationMs > 500 ? '🐌' : durationMs > 200 ? '⚠️' : '⚡'
        console.log(`[PERF] ${emoji} ${label}: ${durationMs}ms`)
      }
      return durationMs
    }
  }
}

/**
 * Log a performance warning if threshold exceeded
 */
export function warnIfSlow(label: string, durationMs: number, thresholdMs: number = 300) {
  if (durationMs > thresholdMs) {
    console.warn(`[PERF] ⚠️ SLOW: ${label} took ${durationMs}ms (threshold: ${thresholdMs}ms)`)
  }
}

