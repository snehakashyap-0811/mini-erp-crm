import { clearSession, getToken } from './auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));

  if (res.status === 401) {
    clearSession();
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, body.message || 'Request failed');
  }

  return body as T;
}
