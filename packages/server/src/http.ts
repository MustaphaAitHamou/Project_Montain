/**
 * Requêtes HTTP sortantes avec délai maximal, nouvelles tentatives à backoff exponentiel
 * (avec gigue) et respect de l'en-tête Retry-After. Les erreurs 4xx (hors 408/429)
 * ne sont pas retentées : elles signalent un problème de requête ou de clé.
 */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface RetryOptions {
  retries?: number;
  timeoutMs?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  userAgent?: string;
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function backoffDelay(
  attempt: number,
  base: number,
  max: number,
  random = Math.random,
): number {
  const exp = Math.min(max, base * 2 ** attempt);
  return Math.round(exp / 2 + random() * (exp / 2));
}

function retryAfterMs(response: Response): number | null {
  const header = response.headers.get('retry-after');
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: RetryOptions = {},
): Promise<Response> {
  const {
    retries = 3,
    timeoutMs = 15000,
    baseDelayMs = 500,
    maxDelayMs = 10000,
    fetchImpl = fetch,
    sleep = defaultSleep,
    userAgent = 'TamurtAlerte/0.1 (+https://tamurt.services)',
  } = options;
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        ...init,
        headers: { 'User-Agent': userAgent, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return response;
      const retryable =
        response.status === 408 || response.status === 429 || response.status >= 500;
      if (!retryable || attempt === retries) {
        throw new HttpError(`HTTP ${response.status}`, response.status, retryable);
      }
      await sleep(
        Math.min(
          maxDelayMs,
          retryAfterMs(response) ?? backoffDelay(attempt, baseDelayMs, maxDelayMs),
        ),
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      lastError = error;
      if (attempt === retries) break;
      await sleep(backoffDelay(attempt, baseDelayMs, maxDelayMs));
    }
  }
  const message = lastError instanceof Error ? lastError.message : 'network error';
  throw new HttpError(`Réseau : ${message}`, null, true);
}
