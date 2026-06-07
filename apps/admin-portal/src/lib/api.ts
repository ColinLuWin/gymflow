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
  login: (email: string, password: string) =>
    request<{ idToken: string; accessToken: string; refreshToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

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
}
