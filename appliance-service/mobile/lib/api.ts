import { readToken } from '@/lib/storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');

export interface User {
  _id: string;
  name: string;
  phone: string;
  location: string;
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

/** Send a typed request to the existing API and surface server errors to the UI. */
export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  if (!API_URL) {
    throw new Error('API URL is not configured. Set EXPO_PUBLIC_API_URL in mobile/.env.');
  }

  const token = options.token ?? await readToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(
        typeof result.error === 'string' ? result.error : 'The request failed. Please try again.',
        response.status,
      );
    }
    return result as T;
  } finally {
    clearTimeout(timeout);
  }
}
