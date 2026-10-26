/**
 * Zamzam Foods API Client
 *
 * Implements robust Dual-Authentication:
 *   1. Sends Authorization: Bearer <token> header from localStorage (works everywhere, including cross-subdomain & third-party cookie blocked environments).
 *   2. Sends credentials: "include" for HttpOnly cookie support.
 *
 * Token refresh flow:
 *   1. Request returns 401
 *   2. Single-flight Promise mutex calls POST /auth/refresh/ with refresh token and credentials
 *   3. Server issues new access + refresh tokens
 *   4. Client updates stored tokens and retries original request
 *   5. If refresh fails with 401 → dispatch auth:logout → frontend redirects to /login
 */

const isTauriApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).__TAURI_INTERNALS__ ||
    (window as any).__TAURI__ ||
    window.location.protocol === 'tauri:' ||
    window.location.hostname === 'tauri.localhost'
  );
};

export const LOCAL_ENGINE_URL = 'http://127.0.0.1:8000/api/v1';
export const DEFAULT_RAILWAY_URL = 'https://zamzamfood.up.railway.app/api/v1';
export const DEFAULT_API_URL = LOCAL_ENGINE_URL;

/**
 * Normalizes any user-entered backend URL:
 * - Trims whitespace and trailing slashes
 * - Adds http:// or https:// protocol if omitted
 * - Automatically appends /api/v1 if not present
 */
export const normalizeApiUrl = (raw: string): string => {
  if (!raw || !raw.trim()) {
    return LOCAL_ENGINE_URL;
  }
  let clean = raw.trim().replace(/\/+$/, '');

  // Add protocol if missing
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    if (clean.startsWith('127.0.0.1') || clean.startsWith('localhost')) {
      clean = `http://${clean}`;
    } else {
      clean = `https://${clean}`;
    }
  }

  // Ensure /api/v1 suffix
  if (clean.endsWith('/api/v1')) {
    return clean;
  }
  if (clean.endsWith('/api')) {
    return `${clean}/v1`;
  }
  return `${clean}/api/v1`;
};

export const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return LOCAL_ENGINE_URL;
  }

  // 1. Explicit override in localStorage (user configured)
  const saved = localStorage.getItem('zamzam_api_url');
  if (saved && saved.trim()) {
    // If previously saved URL was Railway (which is offline/502), clear it and use local engine!
    if (saved.includes('zamzamfood.up.railway.app')) {
      localStorage.removeItem('zamzam_api_url');
      return LOCAL_ENGINE_URL;
    }
    return normalizeApiUrl(saved);
  }

  // 2. Default: always use Local Engine (127.0.0.1:8000)
  return LOCAL_ENGINE_URL;
};

export let API_BASE_URL = getApiBaseUrl();

export const setApiBaseUrl = (url: string): string => {
  if (typeof window !== 'undefined') {
    if (!url || !url.trim()) {
      localStorage.removeItem('zamzam_api_url');
      API_BASE_URL = LOCAL_ENGINE_URL;
      window.dispatchEvent(new CustomEvent('zamzam:api-url-changed', { detail: LOCAL_ENGINE_URL }));
      return LOCAL_ENGINE_URL;
    } else {
      const normalized = normalizeApiUrl(url);
      localStorage.setItem('zamzam_api_url', normalized);
      API_BASE_URL = normalized;
      window.dispatchEvent(new CustomEvent('zamzam:api-url-changed', { detail: normalized }));
      return normalized;
    }
  }
  return LOCAL_ENGINE_URL;
};

/**
 * Quick server health verification used by Login Page and Settings
 */
export const checkServerHealth = async (
  targetUrl?: string
): Promise<{ ok: boolean; status: number; message: string; url: string }> => {
  const base = normalizeApiUrl(targetUrl || getApiBaseUrl());
  const rootUrl = base.replace(/\/api\/v1$/, '');
  const testEndpoints = [
    `${rootUrl}/api/health/`,
    `${base}/settings/`,
    `${base}/auth/verify/`,
  ];

  for (const endpoint of testEndpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.status === 200 || res.status === 401 || res.status === 403) {
        return { ok: true, status: res.status, message: 'Server is online and responding', url: base };
      }
    } catch {
      // Continue to next test endpoint
    }
  }

  return { ok: false, status: 0, message: 'Server unreachable', url: base };
};

/**
 * Fire-and-forget background ping to warm up backend on app launch.
 */
export const warmUpServer = (): void => {
  if (typeof window === 'undefined') return;
  const base = getApiBaseUrl();
  fetch(`${base}/settings/`, { method: 'GET', credentials: 'include' }).catch(() => {});
};

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  /** Set true to skip auto-refresh on 401 (used for the refresh call itself) */
  _skipRefresh?: boolean;
  /** Set true to bypass cache and force network fetch */
  bypassCache?: boolean;
  /** Custom TTL in ms for this request */
  cacheTtlMs?: number;
}

export interface RefreshResult {
  success: boolean;
  isAuthFailure: boolean;
}

class ApiClient {
  private refreshPromise: Promise<RefreshResult> | null = null;
  private cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();
  private inflight = new Map<string, Promise<unknown>>();

  /**
   * Silently obtain a new access token by calling the refresh endpoint.
   * Utilizes a single-flight mutex to prevent concurrent refresh race conditions.
   * Multiple concurrent 401s coalesce into exactly ONE POST /auth/refresh/ request.
   */
  private async refreshAccessToken(): Promise<RefreshResult> {
    const refreshToken = localStorage.getItem('zamzam_refresh_token');
    // If there is no refresh token and no user, we are simply unauthenticated
    if (!refreshToken && !localStorage.getItem('zamzam_user')) {
      return { success: false, isAuthFailure: true };
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async (): Promise<RefreshResult> => {
      // Retry with progressive backoff if server is busy (up to 4 attempts)
      const refreshBackoffs = [800, 1500, 2500];
      const maxRefreshAttempts = refreshBackoffs.length + 1;

      for (let attempt = 1; attempt <= maxRefreshAttempts; attempt++) {
        try {
          const baseUrl = getApiBaseUrl();
          const response = await fetch(`${baseUrl}/auth/refresh/`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: refreshToken ? JSON.stringify({ refresh: refreshToken }) : undefined,
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            const errDetail = typeof data?.detail === 'string' ? data.detail.toLowerCase() : '';
            const isDefinitiveAuthFailure =
              response.status === 401 ||
              (response.status === 400 &&
                (errDetail.includes('token') ||
                  errDetail.includes('invalid') ||
                  errDetail.includes('expired') ||
                  errDetail.includes('blacklisted')));

            if (isDefinitiveAuthFailure) {
              const currentRt = localStorage.getItem('zamzam_refresh_token');
              if (currentRt === refreshToken) {
                this.clearTokens();
                this.dispatchLogout();
              }
              return { success: false, isAuthFailure: true };
            }

            // 500, 502, 503, 504 server cold-start issues: retry with backoff
            if (attempt < maxRefreshAttempts) {
              await new Promise((res) => setTimeout(res, refreshBackoffs[attempt - 1]));
              continue;
            }
            return { success: false, isAuthFailure: false };
          }

          const data = await response.json().catch(() => ({}));
          if (data.access) {
            this.setTokens(data.access, data.refresh || refreshToken || '');
            return { success: true, isAuthFailure: false };
          }
          return { success: false, isAuthFailure: false };
        } catch {
          if (attempt < maxRefreshAttempts) {
            await new Promise((res) => setTimeout(res, refreshBackoffs[attempt - 1]));
            continue;
          }
          return { success: false, isAuthFailure: false };
        }
      }
      return { success: false, isAuthFailure: false };
    })().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private dispatchLogout() {
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }

  public clearCache(prefix?: string) {
    if (!prefix) {
      this.cache.clear();
      return;
    }
    const cleanPrefix = prefix.replace(/^\//, '');
    for (const key of this.cache.keys()) {
      if (key.includes(cleanPrefix)) {
        this.cache.delete(key);
      }
    }
  }

  private invalidateCacheForEndpoint(endpoint: string) {
    if (endpoint.includes('/order')) {
      this.clearCache('order');
      this.clearCache('daily-closing');
      this.clearCache('report');
      this.clearCache('credit');
      this.clearCache('customer');
    } else if (endpoint.includes('/customer')) {
      this.clearCache('customer');
      this.clearCache('balance');
    } else if (endpoint.includes('/payment')) {
      this.clearCache('payment');
      this.clearCache('customer');
      this.clearCache('daily-closing');
    } else if (endpoint.includes('/product')) {
      this.clearCache('product');
    } else if (endpoint.includes('/route')) {
      this.clearCache('route');
      this.clearCache('driver');
    } else {
      this.clearCache();
    }
  }

  public async request<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { _skipRefresh, params, bypassCache, cacheTtlMs, ...fetchOptions } = options;
    const method = (fetchOptions.method || 'GET').toUpperCase();

    const baseUrl = getApiBaseUrl();
    let url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    if (params) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          queryParams.append(key, String(val));
        }
      });
      const queryString = queryParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }

    const defaultTtl =
      endpoint.includes('/products') || endpoint.includes('/routes') || endpoint.includes('/drivers') || endpoint.includes('/settings')
        ? 60_000
        : 15_000;
    const ttl = cacheTtlMs ?? defaultTtl;

    if (method !== 'GET') {
      this.invalidateCacheForEndpoint(endpoint);
    } else if (!bypassCache) {
      const cached = this.cache.get(url);
      const now = Date.now();
      if (cached && now - cached.timestamp < cached.ttl) {
        if (now - cached.timestamp > 4_000 && !this.inflight.has(url)) {
          this.request<T>(endpoint, { ...options, bypassCache: true })
            .then((fresh) => {
              this.cache.set(url, { data: fresh, timestamp: Date.now(), ttl });
            })
            .catch(() => {});
        }
        return cached.data as T;
      }

      const pending = this.inflight.get(url);
      if (pending) {
        return pending as Promise<T>;
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...((fetchOptions.headers as Record<string, string>) || {}),
    };

    if (!(fetchOptions.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // Attach Bearer token if available
    const accessToken = localStorage.getItem('zamzam_access_token');
    if (accessToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    let response: Response | null = null;
    const isLocal = url.includes('127.0.0.1') || url.includes('localhost');
    const coldStartDelays = isLocal ? [400, 800] : [800, 1500, 2500];
    const maxNetworkAttempts = coldStartDelays.length + 1;

    for (let attempt = 1; attempt <= maxNetworkAttempts; attempt++) {
      try {
        response = await fetch(url, {
          ...fetchOptions,
          headers,
          credentials: 'include',
        });

        // If server is cold-starting (502/503/504), wait and retry with progressive backoff
        if (response.status >= 502 && response.status <= 504 && attempt < maxNetworkAttempts) {
          await new Promise((res) => setTimeout(res, coldStartDelays[attempt - 1]));
          continue;
        }

        break;
      } catch {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          throw new Error(
            'You are currently offline. Live operations require a connection to the Zamzam server.'
          );
        }
        if (attempt < maxNetworkAttempts) {
          await new Promise((res) => setTimeout(res, coldStartDelays[attempt - 1]));
          continue;
        }
        throw new Error('Unable to connect to the Zamzam server. Please check your connection and try again.');
      }
    }

    if (!response) {
      throw new Error('Unable to connect to the Zamzam server. Please check your connection and try again.');
    }

    // ── 401 handler: attempt single-flight token refresh then retry with cold-start tolerance ───
    if (
      response.status === 401 &&
      !_skipRefresh &&
      !endpoint.includes('/auth/login') &&
      !endpoint.includes('/auth/refresh')
    ) {
      const refreshResult = await this.refreshAccessToken();

      if (refreshResult.success) {
        // Update authorization header with newly refreshed access token
        const freshToken = localStorage.getItem('zamzam_access_token');
        if (freshToken) {
          headers['Authorization'] = `Bearer ${freshToken}`;
        }
        // Retry fetch with cold-start backoff (up to 3 attempts)
        let retryResponse: Response | null = null;
        for (let rAttempt = 1; rAttempt <= 3; rAttempt++) {
          try {
            retryResponse = await fetch(url, {
              ...fetchOptions,
              headers,
              credentials: 'include',
            });
            if (retryResponse.status >= 502 && retryResponse.status <= 504 && rAttempt < 3) {
              await new Promise((res) => setTimeout(res, rAttempt * 1000));
              continue;
            }
            break;
          } catch {
            if (rAttempt < 3) {
              await new Promise((res) => setTimeout(res, rAttempt * 1000));
              continue;
            }
            throw new Error('Unable to connect to the Zamzam server. Please check your connection and try again.');
          }
        }
        if (!retryResponse) {
          throw new Error('Unable to connect to the Zamzam server. Please check your connection and try again.');
        }
        response = retryResponse;
      } else if (refreshResult.isAuthFailure) {
        throw new Error('Session expired. Please log in again.');
      } else {
        throw new Error('Unable to connect to the Zamzam server. Please check your connection and try again.');
      }
    }

    if (response.status === 204) {
      return {} as T;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      let errorMessage = 'An error occurred while processing the request.';
      if (typeof data?.error === 'string') {
        errorMessage = data.error;
      } else if (data?.error?.message) {
        errorMessage = data.error.message;
      } else if (data?.detail) {
        errorMessage = data.detail;
      } else if (data?.message) {
        errorMessage = data.message;
      } else if (typeof data === 'object' && data !== null) {
        const firstKey = Object.keys(data)[0];
        if (firstKey) {
          const val = data[firstKey];
          errorMessage = Array.isArray(val) ? `${firstKey}: ${val[0]}` : `${firstKey}: ${val}`;
        }
      }
      throw new Error(errorMessage);
    }

    if (method === 'GET' && !bypassCache) {
      this.cache.set(url, { data, timestamp: Date.now(), ttl });
    }

    return data as T;
  }

  public get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>) {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  public post<T>(endpoint: string, body?: unknown) {
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    return this.request<T>(endpoint, {
      method: 'POST',
      body: isForm ? (body as FormData) : (body !== undefined ? JSON.stringify(body) : undefined),
    });
  }

  public patch<T>(endpoint: string, body?: unknown) {
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: isForm ? (body as FormData) : (body !== undefined ? JSON.stringify(body) : undefined),
    });
  }

  public delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  public setTokens(access: string, refresh?: string) {
    if (access) localStorage.setItem('zamzam_access_token', access);
    if (refresh) localStorage.setItem('zamzam_refresh_token', refresh);
  }

  public clearTokens() {
    localStorage.removeItem('zamzam_user');
    localStorage.removeItem('zamzam_access_token');
    localStorage.removeItem('zamzam_refresh_token');
  }
}

export const apiClient = new ApiClient();
