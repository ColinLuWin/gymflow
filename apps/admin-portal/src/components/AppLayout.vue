<template>
  <div class="min-h-screen" style="background-color:#eef0f8;">
    <!-- Gradient nav -->
    <nav class="sticky top-0 z-40"
      style="background: linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%); box-shadow: 0 4px 24px rgba(79,70,229,0.25);">
      <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <span class="text-xl font-black tracking-tight text-white">Gymflow</span>
          <span class="text-xs font-bold bg-white/20 text-white px-2 py-0.5 rounded-full tracking-wide">管理</span>
        </div>
        <div class="flex items-center gap-6">
          <RouterLink to="/scan"
            class="text-sm font-semibold text-white/55 hover:text-white transition-colors"
            active-class="!text-white">掃描發點</RouterLink>
          <RouterLink to="/members"
            class="text-sm font-semibold text-white/55 hover:text-white transition-colors"
            active-class="!text-white">會員管理</RouterLink>
          <RouterLink to="/rewards"
            class="text-sm font-semibold text-white/55 hover:text-white transition-colors"
            active-class="!text-white">獎勵商品</RouterLink>
          <RouterLink to="/redemptions"
            class="text-sm font-semibold text-white/55 hover:text-white transition-colors"
            active-class="!text-white">兌換記錄</RouterLink>
          <button @click="logout"
            class="text-sm font-medium text-white/30 hover:text-white/60 transition-colors ml-1">登出</button>
        </div>
      </div>
    </nav>

    <main class="max-w-6xl mx-auto px-6 py-7">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
const auth = useAuthStore()
const logout = () => auth.logout()
</script>
