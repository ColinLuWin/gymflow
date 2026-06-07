import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const idToken = ref<string | null>(localStorage.getItem('idToken'))
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'))

  const isLoggedIn = computed(() => !!idToken.value)

  function setTokens(tokens: { idToken: string; refreshToken: string }) {
    idToken.value = tokens.idToken
    refreshToken.value = tokens.refreshToken
    localStorage.setItem('idToken', tokens.idToken)
    localStorage.setItem('refreshToken', tokens.refreshToken)
  }

  function logout() {
    idToken.value = null
    refreshToken.value = null
    localStorage.removeItem('idToken')
    localStorage.removeItem('refreshToken')
  }

  return { idToken, refreshToken, isLoggedIn, setTokens, logout }
})
