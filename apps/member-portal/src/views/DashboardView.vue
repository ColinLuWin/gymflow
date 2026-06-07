<template>
  <AppLayout>
    <div v-if="loading" class="text-center py-16 text-gray-400">載入中…</div>

    <template v-else>
      <h2 class="text-xl font-bold text-gray-900 mb-6">會員總覽</h2>

      <div class="grid gap-4 sm:grid-cols-2 mb-6">
        <!-- Profile card -->
        <div class="bg-white rounded-xl border border-gray-200 p-6">
          <p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">歡迎回來</p>
          <p class="text-2xl font-bold text-gray-900">{{ profile?.name ?? '—' }}</p>
          <p class="text-sm text-gray-500 mt-1">{{ profile?.email }}</p>
          <span :class="profile?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
            class="inline-block mt-3 text-xs font-medium px-2.5 py-1 rounded-full">
            {{ profile?.status === 'active' ? '帳號正常' : '帳號停用' }}
          </span>
        </div>

        <!-- Membership card -->
        <div class="bg-white rounded-xl border border-gray-200 p-6">
          <p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">會員方案</p>
          <template v-if="memberships.length">
            <div v-for="m in memberships" :key="m.SK" class="flex items-center justify-between mb-2">
              <span class="text-sm text-gray-700">{{ m.planType ?? '標準方案' }}</span>
              <div class="text-right">
                <span :class="m.membershipStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                  class="text-xs font-medium px-2 py-0.5 rounded-full">
                  {{ m.membershipStatus === 'active' ? '有效' : '已到期' }}
                </span>
                <p v-if="m.expiryDate" class="text-xs text-gray-400 mt-1">到期 {{ m.expiryDate }}</p>
              </div>
            </div>
          </template>
          <p v-else class="text-sm text-gray-400">尚無會員方案</p>
        </div>
      </div>

      <!-- Checkins -->
      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">最近報到記錄</p>
        <template v-if="checkins.length">
          <div v-for="c in checkins" :key="c.SK"
            class="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
            <span class="text-sm text-gray-700">{{ formatCheckinDate(c.SK) }}</span>
            <span class="text-xs text-gray-400">{{ c.locationId ?? '主館' }}</span>
          </div>
        </template>
        <p v-else class="text-sm text-gray-400">尚無報到記錄</p>
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
      api.getProfile(),
      api.getMembership(),
      api.getCheckins(5),
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
  } catch {
    return ts
  }
}
</script>
