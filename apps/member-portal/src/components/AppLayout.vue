<template>
  <div class="min-h-screen bg-gray-50">
    <nav class="bg-white border-b border-gray-200">
      <div class="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <span class="text-lg font-bold text-indigo-600">Gymflow</span>
        <div class="flex items-center gap-5">
          <RouterLink to="/dashboard"
            class="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            active-class="text-indigo-600 font-medium">
            首頁
          </RouterLink>
          <RouterLink to="/points"
            class="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            active-class="text-indigo-600 font-medium">
            我的點數
          </RouterLink>
          <RouterLink to="/rewards"
            class="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            active-class="text-indigo-600 font-medium">
            兌換獎勵
          </RouterLink>
          <RouterLink to="/profile"
            class="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            active-class="text-indigo-600 font-medium">
            個人資料
          </RouterLink>
          <button @click="logout"
            class="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            登出
          </button>
        </div>
      </div>
    </nav>
    <main class="max-w-4xl mx-auto px-4 py-8">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const logout = () => auth.logout()
</script>
