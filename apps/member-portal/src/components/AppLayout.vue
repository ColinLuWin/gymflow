<template>
  <div class="min-h-screen" style="background-color:#eef0f8;">
    <!-- Desktop nav — gradient branded bar -->
    <nav class="hidden md:block sticky top-0 z-40"
      style="background: linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%); box-shadow: 0 4px 24px rgba(79,70,229,0.25);">
      <div class="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
        <span class="text-xl font-black tracking-tight text-white">Gymflow</span>
        <div class="flex items-center gap-7">
          <RouterLink to="/dashboard"
            class="text-sm font-semibold text-white/55 hover:text-white transition-colors"
            active-class="!text-white">首頁</RouterLink>
          <RouterLink to="/points"
            class="text-sm font-semibold text-white/55 hover:text-white transition-colors"
            active-class="!text-white">我的點數</RouterLink>
          <RouterLink to="/rewards"
            class="text-sm font-semibold text-white/55 hover:text-white transition-colors"
            active-class="!text-white">兌換獎勵</RouterLink>
          <RouterLink to="/profile"
            class="text-sm font-semibold text-white/55 hover:text-white transition-colors"
            active-class="!text-white">個人資料</RouterLink>
          <button @click="logout"
            class="text-sm font-medium text-white/30 hover:text-white/60 transition-colors ml-1">登出</button>
        </div>
      </div>
    </nav>

    <!-- Mobile: gradient header band -->
    <div class="md:hidden px-5 pt-5 pb-6"
      style="background: linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%);">
      <span class="text-2xl font-black tracking-tight text-white">Gymflow</span>
    </div>

    <!-- Main content — sits on the tinted background -->
    <main class="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-10">
      <slot />
    </main>

    <!-- Mobile bottom tab bar — white elevated -->
    <nav class="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white"
      style="box-shadow: 0 -1px 0 rgba(0,0,0,0.06), 0 -8px 24px rgba(99,102,241,0.08);">
      <div class="flex items-stretch h-16">
        <RouterLink v-for="tab in tabs" :key="tab.to" :to="tab.to"
          class="flex-1 flex flex-col items-center justify-center gap-1 text-gray-300 transition-colors"
          active-class="!text-indigo-600">
          <component :is="tab.icon" class="w-5 h-5" />
          <span class="text-[10px] font-bold tracking-wide">{{ tab.label }}</span>
        </RouterLink>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const logout = () => auth.logout()

const HomeIcon = () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
  h('path', { d: 'M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z' }),
  h('path', { d: 'M9 21V12h6v9' }),
])
const StarIcon = () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
  h('polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' }),
])
const GiftIcon = () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
  h('polyline', { points: '20 12 20 22 4 22 4 12' }),
  h('rect', { x: '2', y: '7', width: '20', height: '5' }),
  h('line', { x1: '12', y1: '22', x2: '12', y2: '7' }),
  h('path', { d: 'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z' }),
  h('path', { d: 'M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z' }),
])
const UserIcon = () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
  h('path', { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }),
  h('circle', { cx: '12', cy: '7', r: '4' }),
])

const tabs = [
  { to: '/dashboard', label: '首頁',  icon: HomeIcon },
  { to: '/points',    label: '點數',  icon: StarIcon },
  { to: '/rewards',   label: '兌換',  icon: GiftIcon },
  { to: '/profile',   label: '我的',  icon: UserIcon },
]
</script>
