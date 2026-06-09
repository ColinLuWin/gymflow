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
  createdAt: string
}

export interface Redemption {
  PK: string
  SK: string
  redemptionId: string
  rewardId: string
  rewardName: string
  pointsCost: number
  status: 'active' | 'cancelled'
  redeemedAt: string
}

export interface Member {
  PK: string
  SK: string
  sub: string
  email: string
  name: string
  phone?: string
  status: 'active' | 'suspended'
  createdAt: string
  updatedAt: string
}

export const api = {
  listMembers: (cursor?: string) =>
    request<{ members: Member[]; cursor: string | null }>(
      `/admin/members${cursor ? `?cursor=${cursor}` : ''}`,
    ),

  getMember: (id: string) => request<Member>(`/admin/members/${id}`),

  createMember: (data: { email: string; name: string; phone?: string }) =>
    request<{ message: string; sub: string }>('/admin/members', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateMember: (id: string, data: { name?: string; phone?: string }) =>
    request<Member>(`/admin/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  suspendMember: (id: string) =>
    request<{ message: string }>(`/admin/members/${id}/suspend`, { method: 'PUT' }),

  activateMember: (id: string) =>
    request<{ message: string }>(`/admin/members/${id}/activate`, { method: 'PUT' }),

  deleteMember: (id: string) =>
    request<{ message: string }>(`/admin/members/${id}`, { method: 'DELETE' }),

  getMemberPoints: (id: string) =>
    request<{ balance: number; transactions: PointsTxn[] }>(`/admin/members/${id}/points`),

  awardPoints: (id: string, points: number, note?: string) =>
    request<{ message: string }>(`/admin/members/${id}/points`, {
      method: 'POST',
      body: JSON.stringify({ points, note }),
    }),

  listRewards: () => request<{ rewards: Reward[] }>('/admin/rewards'),

  createReward: (data: { name: string; description?: string; pointsCost: number; stock: number }) =>
    request<{ id: string; message: string }>('/admin/rewards', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateReward: (id: string, data: Partial<Pick<Reward, 'name' | 'description' | 'pointsCost' | 'stock' | 'isActive'>>) =>
    request<Reward>(`/admin/rewards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteReward: (id: string) =>
    request<{ message: string }>(`/admin/rewards/${id}`, { method: 'DELETE' }),

  listRedemptions: () => request<{ redemptions: Redemption[] }>('/admin/redemptions'),

  cancelRedemption: (memberId: string, redemptionId: string) =>
    request<{ message: string }>(`/admin/members/${memberId}/redemptions/${redemptionId}/cancel`, {
      method: 'POST',
    }),
}
