import {
  clearToken,
  readRefreshToken,
  readToken,
  writeRefreshToken,
  writeToken,
} from '@/lib/storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');

export interface User {
  _id: string;
  name: string;
  phone: string;
  location: string;
  pinCode: string;
  pinAddress: string;
  createdAt: string;
}

export interface Booking {
  _id: string;
  appliance: string;
  serviceType: string;
  description: string;
  preferredDate: string;
  preferredTime: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'completed';
  createdAt: string;
  userLocation: string;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

let refreshInProgress: Promise<string | null> | null = null;

/** Rotate the saved refresh credential once and share it with concurrent requests. */
async function refreshAccessToken(): Promise<string | null> {
  if (refreshInProgress) return refreshInProgress;

  refreshInProgress = (async () => {
    const refreshToken = await readRefreshToken();
    if (!refreshToken) {
      await clearToken();
      return null;
    }

    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 400 || response.status === 401) {
      await clearToken();
      return null;
    }
    if (!response.ok) {
      throw new ApiError('Could not refresh the customer session.', response.status);
    }
    if (typeof result.accessToken !== 'string' || typeof result.refreshToken !== 'string') {
      throw new Error('The session refresh response was invalid.');
    }

    await writeRefreshToken(result.refreshToken);
    await writeToken(result.accessToken);
    return result.accessToken as string;
  })();

  try {
    return await refreshInProgress;
  } finally {
    refreshInProgress = null;
  }
}

/** Send a typed API request and refresh an expired customer access token once. */
export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string; skipRefresh?: boolean } = {},
): Promise<T> {
  if (!API_URL) {
    throw new Error('API URL is not configured. Set EXPO_PUBLIC_API_URL in mobile/.env.');
  }

  const token = options.token ?? await readToken();
  const send = async (accessToken: string | null) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      return await fetch(`${API_URL}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  let response = await send(token);
  if (response.status === 401 && !options.skipRefresh && !path.startsWith('/auth/')) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) response = await send(refreshedToken);
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      typeof result.error === 'string' ? result.error : 'The request failed. Please try again.',
      response.status,
    );
  }
  return result as T;
}
