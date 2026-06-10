<template>
  <AppLayout>
    <div class="mb-6">
      <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">管理</p>
      <h1 class="text-2xl md:text-3xl font-black tracking-tight text-gray-900">兌換記錄</h1>
    </div>

    <div v-if="loading" class="text-center py-16 text-gray-400">載入中…</div>

    <template v-else>
      <div v-if="actionMsg" class="mb-5 text-sm text-indigo-700 bg-indigo-50 border border-indigo-100 px-4 py-3 rounded-xl">{{ actionMsg }}</div>
      <div v-if="errorMsg"  class="mb-5 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">{{ errorMsg }}</div>

      <div v-if="redemptions.length" class="card overflow-hidden">
        <!-- Mobile card list -->
        <div class="md:hidden divide-y divide-gray-50">
          <div v-for="r in redemptions" :key="r.redemptionId" class="px-5 py-4">
            <div class="flex items-start justify-between mb-1.5">
              <p class="font-semibold text-gray-900 text-sm">{{ r.rewardName }}</p>
              <span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2"
                :class="r.status === 'active' ? 'bg-amber-50 text-amber-700' : r.status === 'used' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'">
                <span class="w-1.5 h-1.5 rounded-full"
                  :class="r.status === 'active' ? 'bg-amber-400' : r.status === 'used' ? 'bg-emerald-500' : 'bg-gray-300'"></span>
                {{ r.status === 'active' ? '待核銷' : r.status === 'used' ? '已核銷' : '已撤銷' }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs text-gray-500">{{ r.pointsCost }} 點・{{ formatDate(r.redeemedAt) }}</p>
                <p class="text-xs font-mono text-gray-300 mt-0.5">{{ r.PK.replace('MEMBER#', '').slice(0, 8) }}…</p>
              </div>
              <button v-if="r.status === 'active'"
                @click="cancel(r)" :disabled="cancelling === r.redemptionId"
                class="text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors">
                撤銷
              </button>
            </div>
          </div>
        </div>

        <!-- Desktop table -->
        <div class="hidden md:block overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>會員</th>
                <th>商品</th>
                <th>點數</th>
                <th>時間</th>
                <th>狀態</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in redemptions" :key="r.redemptionId">
                <td class="font-mono text-xs text-gray-400">{{ r.PK.replace('MEMBER#', '').slice(0, 8) }}…</td>
                <td class="font-semibold text-gray-900">{{ r.rewardName }}</td>
                <td class="text-gray-600">{{ r.pointsCost }} 點</td>
                <td class="text-gray-400 text-xs">{{ formatDate(r.redeemedAt) }}</td>
                <td>
                  <span class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                    :class="r.status === 'active' ? 'bg-amber-50 text-amber-700' : r.status === 'used' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'">
                    <span class="w-1.5 h-1.5 rounded-full"
                      :class="r.status === 'active' ? 'bg-amber-400' : r.status === 'used' ? 'bg-emerald-500' : 'bg-gray-300'"></span>
                    {{ r.status === 'active' ? '待核銷' : r.status === 'used' ? '已核銷' : '已撤銷' }}
                  </span>
                </td>
                <td class="text-right">
                  <button v-if="r.status === 'active'"
                    @click="cancel(r)" :disabled="cancelling === r.redemptionId"
                    class="text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors">
                    撤銷
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-else class="text-center py-16 text-gray-300">尚無兌換記錄</div>
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
