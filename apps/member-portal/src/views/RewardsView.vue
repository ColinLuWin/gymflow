<template>
  <AppLayout>
    <div v-if="loading" class="text-center py-16 text-gray-400">載入中…</div>

    <template v-else>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-bold text-gray-900">兌換獎勵</h2>
        <div class="text-right">
          <p class="text-xs text-gray-400">目前點數</p>
          <p class="text-2xl font-bold text-indigo-600">{{ balance }} 點</p>
        </div>
      </div>

      <p v-if="successMsg" class="mb-4 text-sm bg-green-50 text-green-700 px-4 py-3 rounded-lg">{{ successMsg }}</p>
      <p v-if="errorMsg" class="mb-4 text-sm bg-red-50 text-red-600 px-4 py-3 rounded-lg">{{ errorMsg }}</p>

      <template v-if="rewards.length">
        <div class="grid gap-4 sm:grid-cols-2">
          <div v-for="r in rewards" :key="r.id"
            class="bg-white rounded-xl border border-gray-200 p-5 flex flex-col justify-between">
            <div>
              <p class="font-semibold text-gray-900">{{ r.name }}</p>
              <p v-if="r.description" class="text-sm text-gray-500 mt-1">{{ r.description }}</p>
              <div class="flex items-center gap-2 mt-3">
                <span class="text-lg font-bold text-indigo-600">{{ r.pointsCost }}</span>
                <span class="text-sm text-gray-400">點</span>
                <span v-if="r.stock !== -1" class="ml-auto text-xs text-gray-400">剩餘 {{ r.stock }} 件</span>
                <span v-else class="ml-auto text-xs text-gray-400">無限供應</span>
              </div>
            </div>
            <button @click="redeem(r)"
              :disabled="redeeming === r.id || balance < r.pointsCost || (r.stock === 0)"
              class="mt-4 w-full text-sm font-medium py-2.5 rounded-lg transition-colors"
              :class="balance >= r.pointsCost && r.stock !== 0
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'">
              {{ redeeming === r.id ? '兌換中…' : (r.stock === 0 ? '已售完' : balance < r.pointsCost ? `尚需 ${r.pointsCost - balance} 點` : '立即兌換') }}
            </button>
          </div>
        </div>
      </template>
      <div v-else class="text-center py-16 text-gray-400">目前沒有可兌換的獎勵</div>

      <!-- My redemptions -->
      <div v-if="redemptions.length" class="mt-8 bg-white rounded-xl border border-gray-200 p-6">
        <p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">我的兌換記錄</p>
        <div v-for="r in redemptions" :key="r.redemptionId"
          class="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
          <div class="flex-1 min-w-0 mr-3">
            <p class="text-sm text-gray-800">{{ r.rewardName }}</p>
            <p class="text-xs text-gray-400 mt-0.5">{{ formatDate(r.redeemedAt) }}</p>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <div class="text-right">
              <p class="text-sm font-medium text-gray-700">-{{ r.pointsCost }} 點</p>
              <span :class="statusClass(r.status)" class="text-xs">{{ statusLabel(r.status) }}</span>
            </div>
            <button v-if="r.status === 'active'"
              @click="showQr(r)"
              class="text-xs font-medium bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap">
              出示 QR
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- QR Code Modal -->
    <Teleport to="body">
      <div v-if="qrModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
        @click.self="qrModal = null">
        <div class="bg-white rounded-2xl p-6 w-full max-w-xs flex flex-col items-center shadow-xl">
          <p class="text-base font-semibold text-gray-900 mb-1 text-center">{{ qrModal.rewardName }}</p>
          <p class="text-xs text-gray-400 mb-5 text-center">出示給工作人員掃描核銷</p>

          <div class="p-3 bg-white border-2 border-gray-200 rounded-xl">
            <img v-if="qrModal.dataUrl" :src="qrModal.dataUrl" alt="兌換 QR Code" class="w-52 h-52" />
            <div v-else class="w-52 h-52 flex items-center justify-center">
              <span class="text-xs text-gray-400">產生中…</span>
            </div>
          </div>

          <p class="text-xs text-gray-400 mt-4 text-center">核銷後此 QR 即失效</p>

          <button @click="qrModal = null"
            class="mt-5 w-full text-sm font-medium bg-gray-100 text-gray-700 py-2.5 rounded-lg hover:bg-gray-200 transition-colors">
            關閉
          </button>
        </div>
      </div>
    </Teleport>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import QRCode from 'qrcode'
import AppLayout from '@/components/AppLayout.vue'
import { api, type Reward, type Redemption } from '@/lib/api'

const loading = ref(true)
const balance = ref(0)
const memberId = ref('')
const rewards = ref<Reward[]>([])
const redemptions = ref<Redemption[]>([])
const redeeming = ref<string | null>(null)
const successMsg = ref('')
const errorMsg = ref('')
const qrModal = ref<{ rewardName: string; dataUrl: string } | null>(null)

onMounted(async () => {
  try {
    const [pts, rw, rd, qr] = await Promise.all([
      api.getPoints(),
      api.getRewards(),
      api.getRedemptions(),
      api.getQr(),
    ])
    balance.value = pts.balance
    rewards.value = rw.rewards.sort((a, b) => a.pointsCost - b.pointsCost)
    redemptions.value = rd.redemptions
    memberId.value = qr.memberId
  } finally {
    loading.value = false
  }
})

async function redeem(reward: Reward) {
  if (!confirm(`確定要用 ${reward.pointsCost} 點兌換「${reward.name}」？`)) return
  redeeming.value = reward.id
  errorMsg.value = ''
  successMsg.value = ''
  try {
    await api.redeem(reward.id)
    balance.value -= reward.pointsCost
    if (reward.stock !== -1) reward.stock -= 1
    successMsg.value = `成功兌換「${reward.name}」！請點選兌換記錄旁的「出示 QR」向工作人員核銷。`
    const rd = await api.getRedemptions()
    redemptions.value = rd.redemptions
    setTimeout(() => { successMsg.value = '' }, 8000)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '兌換失敗'
    setTimeout(() => { errorMsg.value = '' }, 5000)
  } finally {
    redeeming.value = null
  }
}

async function showQr(r: Redemption) {
  qrModal.value = { rewardName: r.rewardName, dataUrl: '' }
  const content = `redemption:${memberId.value}:${r.redemptionId}`
  qrModal.value.dataUrl = await QRCode.toDataURL(content, { width: 208, margin: 1 })
}

function statusLabel(status: Redemption['status']) {
  if (status === 'active') return '待核銷'
  if (status === 'used') return '已核銷'
  return '已撤銷'
}

function statusClass(status: Redemption['status']) {
  if (status === 'active') return 'text-green-600'
  if (status === 'used') return 'text-blue-500'
  return 'text-gray-400'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>
