<template>
  <!-- Outer wrapper: always gradient on mobile, split on desktop -->
  <div class="min-h-screen flex flex-col md:flex-row"
    style="background: linear-gradient(160deg, #4f46e5 0%, #7c3aed 55%, #2563eb 100%);">

    <!-- Left: gradient brand panel (desktop only) -->
    <div class="hidden md:flex flex-1 flex-col justify-between p-16 relative overflow-hidden">
      <div class="absolute -top-24 -right-24 w-80 h-80 rounded-full pointer-events-none"
        style="background: rgba(255,255,255,0.06);"></div>
      <div class="absolute bottom-10 -left-16 w-64 h-64 rounded-full pointer-events-none"
        style="background: rgba(255,255,255,0.04);"></div>

      <div class="relative">
        <div class="flex items-center gap-2.5 mb-8">
          <span class="text-3xl font-black tracking-tight text-white">Gymflow</span>
          <span class="text-xs font-bold bg-white/20 text-white px-2.5 py-1 rounded-full tracking-wide">管理者入口</span>
        </div>
        <h2 class="text-5xl font-black tracking-tight text-white leading-tight mb-4">
          管理你的<br />健身房會員
        </h2>
        <p class="text-white/50 text-base max-w-sm">掃描 QR 發點、管理會員資料、設定兌換獎勵，一站搞定。</p>
      </div>

      <p class="relative text-white/25 text-xs">© 2025 Gymflow. All rights reserved.</p>
    </div>

    <!-- Mobile brand area (mobile only, fills remaining space above form card) -->
    <div class="md:hidden flex flex-col items-center justify-end flex-1 px-6 pt-16 pb-8">
      <div class="flex items-center gap-2.5 mb-3">
        <span class="text-3xl font-black tracking-tight text-white">Gymflow</span>
        <span class="text-xs font-bold bg-white/20 text-white px-2.5 py-1 rounded-full">管理者入口</span>
      </div>
      <p class="text-white/50 text-sm text-center">掃描 QR 發點、管理會員資料、設定獎勵</p>
    </div>

    <!-- Right: form panel -->
    <div class="w-full md:w-[420px] bg-white rounded-t-3xl md:rounded-none flex flex-col justify-center px-8 md:px-14 py-10 md:py-16"
      style="box-shadow: -8px 0 40px rgba(79,70,229,0.08);">
      <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-8">管理者登入</p>

      <button @click="auth.startLogin()"
        class="w-full flex items-center gap-4 rounded-2xl py-4 px-5 text-sm font-semibold text-gray-800 bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-100">
        <svg class="w-5 h-5 shrink-0" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        使用 Google 登入
      </button>

      <p v-if="errorMsg" class="mt-5 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-2xl">
        {{ errorMsg }}
      </p>

      <p class="mt-8 text-xs text-gray-300 text-center">僅限授權的管理者帳號</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth  = useAuthStore()
const route = useRoute()

const errorMsg = computed(() => {
  const e = route.query.error as string | undefined
  if (!e) return ''
  if (e === 'access_denied') return '登入被取消或拒絕，請重試。'
  return decodeURIComponent(e)
})
</script>
