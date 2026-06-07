<template>
  <AppLayout>
    <h2 class="text-xl font-bold text-gray-900 mb-6">兌換記錄</h2>

    <div v-if="loading" class="text-center py-16 text-gray-400">載入中…</div>

    <template v-else>
      <p v-if="actionMsg" class="mb-4 text-sm bg-blue-50 text-blue-700 px-3 py-2 rounded-lg">{{ actionMsg }}</p>
      <p v-if="errorMsg" class="mb-4 text-sm bg-red-50 text-red-600 px-3 py-2 rounded-lg">{{ errorMsg }}</p>

      <div v-if="redemptions.length" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">會員</th>
              <th class="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">商品</th>
              <th class="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">點數</th>
              <th class="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">時間</th>
              <th class="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">狀態</th>
              <th class="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="r in redemptions" :key="r.redemptionId" class="hover:bg-gray-50">
              <td class="px-5 py-4 text-gray-600 font-mono text-xs">{{ r.PK.replace('MEMBER#', '').slice(0, 8) }}…</td>
              <td class="px-5 py-4 text-gray-900 font-medium">{{ r.rewardName }}</td>
              <td class="px-5 py-4 text-gray-700">{{ r.pointsCost }} 點</td>
              <td class="px-5 py-4 text-gray-500 text-xs">{{ formatDate(r.redeemedAt) }}</td>
              <td class="px-5 py-4">
                <span :class="r.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                  class="text-xs font-medium px-2 py-0.5 rounded-full">
                  {{ r.status === 'active' ? '有效' : '已撤銷' }}
                </span>
              </td>
              <td class="px-5 py-4 text-right">
                <button v-if="r.status === 'active'"
                  @click="cancel(r)" :disabled="cancelling === r.redemptionId"
                  class="text-xs text-red-600 hover:text-red-700 disabled:opacity-50 font-medium">
                  撤銷
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="text-center py-16 text-gray-400">尚無兌換記錄</div>
    </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import { api, type Redemption } from '@/lib/api'

const loading = ref(true)
const redemptions = ref<Redemption[]>([])
const cancelling = ref<string | null>(null)
const actionMsg = ref('')
const errorMsg = ref('')

onMounted(async () => {
  await load()
  loading.value = false
})

async function load() {
  const res = await api.listRedemptions()
  redemptions.value = res.redemptions
}

async function cancel(r: Redemption) {
  if (!confirm(`確定撤銷「${r.rewardName}」的兌換？點數將補回給會員。`)) return
  cancelling.value = r.redemptionId
  errorMsg.value = ''
  try {
    const memberId = r.PK.replace('MEMBER#', '')
    await api.cancelRedemption(memberId, r.redemptionId)
    r.status = 'cancelled'
    actionMsg.value = '已撤銷，點數已補回'
    setTimeout(() => { actionMsg.value = '' }, 4000)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '撤銷失敗'
    setTimeout(() => { errorMsg.value = '' }, 4000)
  } finally {
    cancelling.value = null
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>
