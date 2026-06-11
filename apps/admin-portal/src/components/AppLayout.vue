<template>
  <div class="min-h-screen" style="background-color:#eef0f8;">
    <!-- Gradient nav -->
    <nav class="sticky top-0 z-40"
      style="background: linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%); box-shadow: 0 4px 24px rgba(79,70,229,0.25);">
      <div class="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        <!-- Brand -->
        <div class="flex items-center gap-2.5">
          <span class="text-xl font-black tracking-tight text-white">Gymflow</span>
          <span class="text-xs font-bold bg-white/20 text-white px-2 py-0.5 rounded-full tracking-wide">管理</span>
        </div>

        <!-- Desktop nav links -->
        <div class="hidden md:flex items-center gap-6">
          <RouterLink v-for="link in navLinks" :key="link.to" :to="link.to"
            class="text-sm font-semibold text-white/55 hover:text-white transition-colors"
            active-class="!text-white">{{ link.label }}</RouterLink>
          <div class="w-px h-4 bg-white/20 ml-1"></div>
          <button @click="logout"
            class="text-sm font-semibold text-white/70 hover:text-white transition-colors">登出</button>
        </div>

        <!-- Mobile hamburger -->
        <button @click="menuOpen = !menuOpen" class="md:hidden w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors">
          <svg v-if="!menuOpen" class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <svg v-else class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Mobile dropdown menu -->
      <div v-if="menuOpen" class="md:hidden border-t border-white/10 px-3 py-2 space-y-0.5">
        <RouterLink v-for="link in navLinks" :key="link.to" :to="link.to"
          @click="menuOpen = false"
          class="flex items-center px-3 py-2.5 rounded-xl text-sm font-semibold text-white/65 hover:text-white hover:bg-white/10 transition-colors"
          active-class="!text-white !bg-white/15">
          {{ link.label }}
        </RouterLink>
        <div class="border-t border-white/10 my-1.5"></div>
        <button @click="logout"
          class="w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-semibold text-white/65 hover:text-white hover:bg-white/10 transition-colors">
          登出
        </button>
      </div>
    </nav>

    <main class="max-w-6xl mx-auto px-4 md:px-6 py-5 md:py-7">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const menuOpen = ref(false)

watch(() => route.path, () => { menuOpen.value = false })

const navLinks = computed(() => [
  { to: '/scan',        label: '掃描發點' },
  { to: '/members',     label: '會員管理' },
  { to: '/rewards',     label: '獎勵商品' },
  { to: '/redemptions', label: '兌換記錄' },
  ...(auth.isAdmin ? [{ to: '/approvals', label: '審核管理' }] : []),
  ...(auth.isAdmin ? [{ to: '/line-broadcast', label: 'LINE 推播' }] : []),
])

function logout() { auth.logout() }
</script>
