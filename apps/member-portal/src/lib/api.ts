const BASE = import.meta.env.VITE_API_URL as string

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('idToken')
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((options.headers as Record<string, string>) ?? {}),
    },
  })

  if (res.status === 401) {
    localStorage.removeItem('idToken')
    localStorage.removeItem('refreshToken')
    window.location.href = '/login'
    throw new Error('Session expired')
  }

  const data = await res.json()
  if (!res.ok) throw new Error((data as { message?: string }).message ?? 'Request failed')
  return data as T
}

export interface Profile {
  PK: string
  SK: string
  sub: string
  email: string
  name: string
  phone?: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface Membership {
  SK: string
  planType?: string
  membershipStatus?: string
  expiryDate?: string
}

export interface Checkin {
  SK: string
  checkinAt?: string
  locationId?: string
}

export const api = {
  register: (email: string, password: string, name: string) =>
    request<{ message: string; sub: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),

  confirm: (email: string, code: string) =>
    request<{ message: string }>('/auth/confirm', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),

  login: (email: string, password: string) =>
    request<{ idToken: string; accessToken: string; refreshToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getProfile: () => request<Profile>('/members/me'),

  updateProfile: (data: { name?: string; phone?: string }) =>
    request<Profile>('/members/me', { method: 'PUT', body: JSON.stringify(data) }),

  getMembership: () => request<{ memberships: Membership[] }>('/members/me/membership'),

  getCheckins: (limit = 10) =>
    request<{ checkins: Checkin[]; cursor: string | null }>(`/members/me/checkins?limit=${limit}`),
}
