<template>
  <div class="min-h-screen flex items-center justify-center px-4"
    style="background: linear-gradient(160deg, #4f46e5 0%, #7c3aed 55%, #2563eb 100%);">

    <div class="w-full max-w-md">
      <!-- Brand -->
      <div class="text-center mb-8">
        <span class="text-3xl font-black tracking-tight text-white">Gymflow</span>
        <span class="text-xs font-bold bg-white/20 text-white px-2 py-0.5 rounded-full tracking-wide ml-2">管理</span>
      </div>

      <div class="bg-white rounded-3xl p-8 shadow-2xl">
        <!-- Icon -->
        <div class="flex justify-center mb-5">
          <div class="w-16 h-16 rounded-2xl flex items-center justify-center"
            :class="status === 'rejected'
              ? 'bg-red-50'
              : 'bg-indigo-50'">
            <svg v-if="status !== 'rejected'" class="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <svg v-else class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
        </div>

        <template v-if="status === 'rejected'">
          <h1 class="text-xl font-black text-gray-900 text-center mb-2">申請已被拒絕</h1>
          <p class="text-sm text-gray-500 text-center mb-6">
            你的後台存取申請已遭到管理者拒絕。<br>如有疑問請聯繫健身房管理者。
          </p>
        </template>
        <template v-else>
          <h1 class="text-xl font-black text-gray-900 text-center mb-2">等待管理者審核</h1>
          <p class="text-sm text-gray-500 text-center mb-6">
            你的帳號已成功建立，正在等待管理者核准後台存取權限。<br>通常在數小時內完成。
          </p>

          <div v-if="requestedAt" class="bg-indigo-50 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
            <div class="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse"></div>
            <div>
              <p class="text-xs font-bold text-indigo-700">申請已送出</p>
              <p class="text-xs text-indigo-400 mt-0.5">{{ formatDate(requestedAt) }}</p>
            </div>
          </div>
        </template>

        <div v-if="error" class="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">
          {{ error }}
        </div>

        <div class="flex flex-col gap-3">
          <button v-if="status !== 'rejected'" @click="checkApproval" :disabled="checking"
            class="btn-primary w-full">
            {{ checking ? '確認中…' : '我已獲得核准，重新載入' }}
          </button>
          <button @click="logout"
            class="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-100">
            登出
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/api'

const auth = useAuthStore()
const status = ref<'pending' | 'approved' | 'rejected'>('pending')
const requestedAt = ref('')
const checking = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    const res = await api.requestAccess()
    status.value = res.status
    requestedAt.value = res.requestedAt
  } catch (e) {
    error.value = e instanceof Error ? e.message : '無法送出申請'
  }
})

async function checkApproval() {
  checking.value = true
  error.value = ''
  try {
    const res = await api.requestAccess()
    status.value = res.status
    if (res.status === 'approved') {
      // Force full reload so router re-evaluates with fresh token
      window.location.href = '/members'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '確認失敗'
  } finally {
    checking.value = false
  }
}

function logout() { auth.logout() }

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>
