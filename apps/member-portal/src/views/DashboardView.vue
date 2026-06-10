<template>
  <AppLayout>
    <div v-if="loading" class="text-center py-16 text-gray-400">載入中…</div>

    <template v-else>
      <!-- Greeting -->
      <div class="mb-6 mt-1">
        <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">歡迎回來</p>
        <h1 class="text-3xl font-black tracking-tight text-gray-900">{{ profile?.name ?? '—' }}</h1>
      </div>

      <!-- Status row -->
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="card p-5">
          <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">帳號狀態</p>
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full"
              :class="profile?.status === 'active' ? 'bg-emerald-400' : 'bg-red-500'"></span>
            <span class="text-base font-black text-gray-900">
              {{ profile?.status === 'active' ? '正常' : '停用' }}
            </span>
          </div>
        </div>

        <div class="card p-5">
          <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">會員方案</p>
          <template v-if="memberships.length">
            <p class="text-base font-black text-gray-900 leading-tight">
              {{ memberships[0].planType ?? '標準方案' }}
            </p>
            <p v-if="memberships[0].expiryDate" class="text-xs text-gray-400 mt-1">
              {{ memberships[0].expiryDate }} 到期
            </p>
          </template>
          <p v-else class="text-sm text-gray-300 font-medium">尚無方案</p>
        </div>
      </div>

      <!-- Email subtle -->
      <p class="text-sm text-gray-400 mb-6 px-1">{{ profile?.email }}</p>

      <!-- Checkins -->
      <div class="card overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-50">
          <p class="text-xs font-bold uppercase tracking-widest text-gray-400">最近報到記錄</p>
        </div>
        <template v-if="checkins.length">
          <div v-for="(c, i) in checkins" :key="c.SK"
            class="flex items-center justify-between px-6 py-4"
            :class="i < checkins.length - 1 ? 'border-b border-gray-50' : ''">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style="background: linear-gradient(135deg,#eef2ff,#ede9fe);">
                <div class="w-2 h-2 rounded-full bg-indigo-500"></div>
              </div>
              <span class="text-sm font-semibold text-gray-700">{{ formatCheckinDate(c.SK) }}</span>
            </div>
            <span class="text-xs font-medium text-gray-400">{{ c.locationId ?? '主館' }}</span>
          </div>
        </template>
        <div v-else class="px-6 py-10 text-center text-sm text-gray-300">尚無報到記錄</div>
      </div>
    </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import { api, type Profile, type Membership, type Checkin } from '@/lib/api'

const loading = ref(true)
const profile = ref<Profile | null>(null)
const memberships = ref<Membership[]>([])
const checkins = ref<Checkin[]>([])

onMounted(async () => {
  try {
    const [p, m, c] = await Promise.all([
      api.getProfile(), api.getMembership(), api.getCheckins(5),
    ])
    profile.value = p
    memberships.value = m.memberships
    checkins.value = c.checkins
  } finally {
    loading.value = false
  }
})

function formatCheckinDate(sk: string) {
  const ts = sk.replace('CHECKIN#', '')
  try {
    return new Date(ts).toLocaleString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return ts }
}
</script>
