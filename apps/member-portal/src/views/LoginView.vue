<template>
  <div class="min-h-screen flex flex-col md:flex-row"
    style="background: linear-gradient(160deg, #4f46e5 0%, #7c3aed 55%, #2563eb 100%);">

    <!-- Left: gradient brand panel (desktop only) / full bg (mobile) -->
    <div class="md:flex-1 min-h-screen md:min-h-0 flex flex-col justify-between p-10 md:p-16 relative overflow-hidden">

      <!-- Decorative circles -->
      <div class="absolute -top-24 -right-24 w-80 h-80 rounded-full pointer-events-none"
        style="background: rgba(255,255,255,0.06);"></div>
      <div class="absolute bottom-10 -left-16 w-64 h-64 rounded-full pointer-events-none"
        style="background: rgba(255,255,255,0.04);"></div>

      <!-- Brand -->
      <div class="relative">
        <p class="text-xs font-bold uppercase tracking-widest text-indigo-200 mb-4">Member Portal</p>
        <h1 class="text-5xl md:text-6xl font-black tracking-tight text-white leading-none mb-4">Gymflow</h1>
        <p class="text-white/50 text-base max-w-xs">專屬會員點數、獎勵兌換，一站式管理你的健身旅程。</p>
      </div>

      <!-- Bottom tagline (desktop only) -->
      <p class="relative text-white/25 text-xs hidden md:block">© 2025 Gymflow. All rights reserved.</p>

      <!-- Mobile: action panel sits here -->
      <div class="relative md:hidden mt-12 pb-2">
        <div class="bg-white rounded-3xl p-7"
          style="box-shadow: 0 -4px 60px rgba(0,0,0,0.20);">
          <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">選擇登入方式</p>
          <div class="space-y-3">
            <button @click="loginWith('Google')" :disabled="loading"
              class="w-full flex items-center gap-4 rounded-2xl py-4 px-5 text-sm font-semibold text-gray-800 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 transition-colors border border-gray-100">
              <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              使用 Google 登入
            </button>
            <button @click="loginWith('LINE')" :disabled="loading"
              class="w-full flex items-center gap-4 rounded-2xl py-4 px-5 text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
              style="background-color: #06C755;">
              <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="white">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
              </svg>
              使用 LINE 登入
            </button>
          </div>
          <p v-if="error" class="mt-5 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-2xl">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Right: login form (desktop only) -->
    <div class="hidden md:flex w-full md:w-[420px] bg-white flex-col justify-center px-14 py-16"
      style="box-shadow: -8px 0 40px rgba(79,70,229,0.08);">
      <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-8">選擇登入方式</p>

      <div class="space-y-3">
        <button @click="loginWith('Google')" :disabled="loading"
          class="w-full flex items-center gap-4 rounded-2xl py-4 px-5 text-sm font-semibold text-gray-800 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 transition-colors border border-gray-100">
          <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          使用 Google 登入
        </button>

        <button @click="loginWith('LINE')" :disabled="loading"
          class="w-full flex items-center gap-4 rounded-2xl py-4 px-5 text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
          style="background-color: #06C755;">
          <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="white">
            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
          </svg>
          使用 LINE 登入
        </button>
      </div>

      <p v-if="error" class="mt-6 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-2xl">
        {{ error }}
      </p>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const loading = ref(false)
const error = ref('')

onMounted(() => {
  if (route.query.error) error.value = route.query.error as string
})

async function loginWith(provider: 'Google' | 'LINE') {
  loading.value = true
  error.value = ''
  await auth.startLogin(provider)
}
</script>
