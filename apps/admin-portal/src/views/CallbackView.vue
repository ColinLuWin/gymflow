<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="text-center">
      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
      <p v-else class="text-gray-500 text-sm">登入中，請稍候…</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route  = useRoute()
const auth   = useAuthStore()
const error  = ref('')

onMounted(async () => {
  const code      = route.query.code as string | undefined
  const authError = route.query.error as string | undefined

  if (authError) {
    router.replace(`/login?error=${encodeURIComponent(authError)}`)
    return
  }

  if (!code) {
    router.replace('/login')
    return
  }

  try {
    await auth.handleCallback(code)
    router.replace('/members')
  } catch (e) {
    const msg = e instanceof Error ? e.message : '登入失敗，請重試'
    error.value = msg
    setTimeout(() => router.replace(`/login?error=${encodeURIComponent(msg)}`), 2000)
  }
})
</script>
