import axios from "axios";

export async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!shouldRetry(err) || attempt === maxRetries) break;
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s…
      await sleep(delay);
    }
  }
  throw lastError;
}

function shouldRetry(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    return !status || status === 429 || status >= 500;
  }
  return true; // network error
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
