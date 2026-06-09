<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="text-center">
      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
      <p v-else class="text-gray-500 text-sm">正在綁定 LINE 帳號，請稍候…</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/api'

const router = useRouter()
const route  = useRoute()
const auth   = useAuthStore()
const error  = ref('')

onMounted(async () => {
  if (!auth.isLoggedIn) {
    router.replace('/login')
    return
  }

  const code      = route.query.code as string | undefined
  const state     = route.query.state as string | undefined
  const authError = route.query.error as string | undefined

  if (authError) {
    router.replace(`/profile?error=${encodeURIComponent(authError)}`)
    return
  }

  if (!code) {
    router.replace('/profile')
    return
  }

  // Verify CSRF state
  const savedState = sessionStorage.getItem('line_link_state')
  sessionStorage.removeItem('line_link_state')
  if (!savedState || savedState !== state) {
    router.replace('/profile?error=' + encodeURIComponent('狀態驗證失敗，請重試'))
    return
  }

  try {
    await api.linkLine(code, `${window.location.origin}/link-callback`)
    router.replace('/profile?linked=true')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'LINE 綁定失敗，請再試一次'
    error.value = msg
    setTimeout(() => router.replace(`/profile?error=${encodeURIComponent(msg)}`), 2000)
  }
})
</script>
