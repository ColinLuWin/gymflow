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
  lineUserId?: string
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

export interface PointsTxn {
  SK: string
  type: 'award' | 'redeem' | 'refund'
  delta: number
  note?: string
  awardedBy?: string
  createdAt: string
}

export interface Reward {
  PK: string
  id: string
  name: string
  description?: string
  pointsCost: number
  stock: number
  isActive: boolean
}

export interface Redemption {
  SK: string
  redemptionId: string
  rewardId: string
  rewardName: string
  pointsCost: number
  status: 'active' | 'used' | 'cancelled'
  redeemedAt: string
  usedAt?: string
}

export const api = {
  linkLine: (code: string, redirectUri: string) =>
    request<{ lineUserId: string }>('/auth/link/line', {
      method: 'POST',
      body: JSON.stringify({ code, redirectUri }),
    }),

  unlinkLine: () => request<{ message: string }>('/members/me/line', { method: 'DELETE' }),

  getProfile: () => request<Profile>('/members/me'),

  updateProfile: (data: { name?: string; phone?: string }) =>
    request<Profile>('/members/me', { method: 'PUT', body: JSON.stringify(data) }),

  getMembership: () => request<{ memberships: Membership[] }>('/members/me/membership'),

  getCheckins: (limit = 10) =>
    request<{ checkins: Checkin[]; cursor: string | null }>(`/members/me/checkins?limit=${limit}`),

  getQr: () => request<{ memberId: string }>('/members/me/qr'),

  getPoints: () =>
    request<{ balance: number; transactions: PointsTxn[] }>('/members/me/points'),

  getRewards: () => request<{ rewards: Reward[] }>('/members/rewards'),

  redeem: (rewardId: string) =>
    request<{ message: string; redemptionId: string }>('/members/me/redemptions', {
      method: 'POST',
      body: JSON.stringify({ rewardId }),
    }),

  getRedemptions: () => request<{ redemptions: Redemption[] }>('/members/me/redemptions'),
}
