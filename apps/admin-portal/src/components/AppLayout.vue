<template>
  <div class="min-h-screen bg-gray-50">
    <nav class="bg-white border-b border-gray-200">
      <div class="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-lg font-bold text-indigo-600">Gymflow</span>
          <span class="text-xs bg-indigo-100 text-indigo-700 font-medium px-2 py-0.5 rounded-full">管理</span>
        </div>
        <div class="flex items-center gap-6">
          <RouterLink to="/members"
            class="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            active-class="text-indigo-600 font-medium">
            會員管理
          </RouterLink>
          <button @click="logout" class="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            登出
          </button>
        </div>
      </div>
    </nav>
    <main class="max-w-6xl mx-auto px-4 py-8">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

function logout() {
  auth.logout()
  router.push('/login')
}
</script>
