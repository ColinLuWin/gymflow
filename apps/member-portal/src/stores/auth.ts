import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN as string
const CLIENT_ID      = import.meta.env.VITE_COGNITO_CLIENT_ID as string

function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data   = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export const useAuthStore = defineStore('auth', () => {
  const idToken     = ref<string | null>(localStorage.getItem('idToken'))
  const accessToken = ref<string | null>(localStorage.getItem('accessToken'))
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'))

  const isLoggedIn = computed(() => !!idToken.value)

  async function startLogin(provider: 'Google' | 'LINE') {
    const verifier   = generateCodeVerifier()
    const challenge  = await generateCodeChallenge(verifier)
    sessionStorage.setItem('pkce_verifier', verifier)

    const params = new URLSearchParams({
      response_type:          'code',
      client_id:              CLIENT_ID,
      redirect_uri:           `${window.location.origin}/callback`,
      scope:                  'openid email profile',
      code_challenge:         challenge,
      code_challenge_method:  'S256',
      identity_provider:      provider,
    })
    window.location.href = `${COGNITO_DOMAIN}/oauth2/authorize?${params}`
  }

  async function handleCallback(code: string): Promise<void> {
    const verifier = sessionStorage.getItem('pkce_verifier')
    if (!verifier) throw new Error('PKCE verifier missing — please try logging in again')

    const res = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        client_id:     CLIENT_ID,
        redirect_uri:  `${window.location.origin}/callback`,
        code_verifier: verifier,
      }).toString(),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Token exchange failed: ${text}`)
    }

    const tokens = await res.json() as {
      id_token: string
      access_token: string
      refresh_token: string
    }

    sessionStorage.removeItem('pkce_verifier')
    setTokens({ idToken: tokens.id_token, accessToken: tokens.access_token, refreshToken: tokens.refresh_token })
  }

  function setTokens(tokens: { idToken: string; accessToken: string; refreshToken: string }) {
    idToken.value      = tokens.idToken
    accessToken.value  = tokens.accessToken
    refreshToken.value = tokens.refreshToken
    localStorage.setItem('idToken', tokens.idToken)
    localStorage.setItem('accessToken', tokens.accessToken)
    localStorage.setItem('refreshToken', tokens.refreshToken)
  }

  function logout() {
    idToken.value      = null
    accessToken.value  = null
    refreshToken.value = null
    localStorage.removeItem('idToken')
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')

    const params = new URLSearchParams({
      client_id:  CLIENT_ID,
      logout_uri: `${window.location.origin}/login`,
    })
    window.location.href = `${COGNITO_DOMAIN}/logout?${params}`
  }

  return { idToken, accessToken, refreshToken, isLoggedIn, startLogin, handleCallback, setTokens, logout }
})
