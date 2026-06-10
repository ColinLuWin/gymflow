import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN as string
const CLIENT_ID      = import.meta.env.VITE_COGNITO_CLIENT_ID as string

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return {}
  }
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data    = new TextEncoder().encode(verifier)
  const digest  = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export const useAuthStore = defineStore('auth', () => {
  const idToken      = ref<string | null>(localStorage.getItem('idToken'))
  const accessToken  = ref<string | null>(localStorage.getItem('accessToken'))
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'))

  const isLoggedIn = computed(() => !!idToken.value)

  const groups = computed<string[]>(() => {
    if (!idToken.value) return []
    const payload = decodeJwtPayload(idToken.value)
    const g = payload['cognito:groups']
    if (!g) return []
    if (Array.isArray(g)) return g as string[]
    if (typeof g === 'string') return g.replace(/^\[|\]$/g, '').split(' ').filter(Boolean)
    return []
  })

  const isAdmin    = computed(() => groups.value.includes('admin'))
  const isTrainer  = computed(() => groups.value.includes('trainer'))
  const isPendingApproval = computed(() => isLoggedIn.value && !isAdmin.value && !isTrainer.value)

  function setTokens(tokens: { idToken: string; accessToken: string; refreshToken: string }) {
    idToken.value      = tokens.idToken
    accessToken.value  = tokens.accessToken
    refreshToken.value = tokens.refreshToken
    localStorage.setItem('idToken',      tokens.idToken)
    localStorage.setItem('accessToken',  tokens.accessToken)
    localStorage.setItem('refreshToken', tokens.refreshToken)
  }

  async function startLogin() {
    const verifier   = generateCodeVerifier()
    const challenge  = await generateCodeChallenge(verifier)
    sessionStorage.setItem('pkce_verifier', verifier)

    const params = new URLSearchParams({
      response_type:         'code',
      client_id:             CLIENT_ID,
      redirect_uri:          `${window.location.origin}/callback`,
      scope:                 'openid email profile',
      code_challenge:        challenge,
      code_challenge_method: 'S256',
      identity_provider:     'Google',
    })
    window.location.href = `${COGNITO_DOMAIN}/oauth2/authorize?${params}`
  }

  async function handleCallback(code: string): Promise<void> {
    const verifier = sessionStorage.getItem('pkce_verifier')
    if (!verifier) throw new Error('Missing PKCE verifier')

    const res = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        client_id:     CLIENT_ID,
        redirect_uri:  `${window.location.origin}/callback`,
        code_verifier: verifier,
      }).toString(),
    })

    sessionStorage.removeItem('pkce_verifier')

    const tokens = await res.json()
    if (!res.ok) throw new Error(tokens.error_description ?? tokens.error ?? 'Token exchange failed')

    setTokens({
      idToken:      tokens.id_token,
      accessToken:  tokens.access_token,
      refreshToken: tokens.refresh_token,
    })
  }

  function logout() {
    idToken.value      = null
    accessToken.value  = null
    refreshToken.value = null
    localStorage.removeItem('idToken')
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    window.location.href =
      `${COGNITO_DOMAIN}/logout?client_id=${CLIENT_ID}&logout_uri=${window.location.origin}/login`
  }

  return { idToken, accessToken, refreshToken, isLoggedIn, groups, isAdmin, isTrainer, isPendingApproval, setTokens, startLogin, handleCallback, logout }
})
