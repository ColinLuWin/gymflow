<template>
  <AppLayout>
    <div v-if="loading" class="text-center py-16 text-gray-300">載入中…</div>

    <template v-else>
      <div class="flex items-end justify-between mb-6">
        <div>
          <p class="text-sm text-gray-400 mb-1">您的點數</p>
          <div class="flex items-baseline gap-1.5">
            <span class="text-5xl font-black tracking-tight text-gray-900">{{ balance }}</span>
            <span class="text-lg text-gray-400 font-medium">pts</span>
          </div>
        </div>
      </div>

      <div v-if="successMsg" class="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 px-4 py-3 rounded-xl">{{ successMsg }}</div>
      <div v-if="errorMsg" class="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">{{ errorMsg }}</div>

      <template v-if="rewards.length">
        <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">可兌換獎勵</p>
        <div class="space-y-3 mb-6">
          <div v-for="r in rewards" :key="r.id"
            class="card flex items-center gap-4 p-4">
            <div class="flex-1 min-w-0">
              <p class="text-gray-900 font-bold">{{ r.name }}</p>
              <p v-if="r.description" class="text-sm text-gray-400 mt-0.5">{{ r.description }}</p>
              <p class="text-sm text-gray-500 mt-1">
                <span class="font-black text-indigo-600">{{ r.pointsCost }}</span> pts
                <span v-if="r.stock !== -1" class="ml-2 text-gray-300">· 剩餘 {{ r.stock }}</span>
              </p>
            </div>
            <button @click="redeem(r)"
              :disabled="redeeming === r.id || balance < r.pointsCost || r.stock === 0"
              class="shrink-0 text-sm font-bold px-4 py-2 rounded-xl transition-all"
              :class="balance >= r.pointsCost && r.stock !== 0
                ? 'btn-primary'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed'">
              {{ redeeming === r.id ? '…' : r.stock === 0 ? '售完' : balance < r.pointsCost ? `差 ${r.pointsCost - balance}` : '兌換' }}
            </button>
          </div>
        </div>
      </template>
      <div v-else class="text-center py-12 text-sm text-gray-300">目前沒有可兌換的獎勵</div>

      <template v-if="redemptions.length">
        <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">我的兌換記錄</p>
        <div class="card overflow-hidden">
          <div v-for="(r, i) in redemptions" :key="r.redemptionId"
            class="flex items-center justify-between px-4 py-4"
            :class="i < redemptions.length - 1 ? 'border-b border-gray-50' : ''">
            <div class="flex-1 min-w-0 mr-3">
              <p class="text-sm text-gray-800 font-semibold">{{ r.rewardName }}</p>
              <p class="text-xs text-gray-400 mt-0.5">{{ formatDate(r.redeemedAt) }}</p>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <span class="text-xs font-semibold" :class="statusClass(r.status)">{{ statusLabel(r.status) }}</span>
              <button v-if="r.status === 'active'" @click="showQr(r)"
                class="btn-primary text-xs px-3 py-1.5 rounded-lg">出示 QR</button>
            </div>
          </div>
        </div>
      </template>
    </template>

    <Teleport to="body">
      <div v-if="qrModal" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
        @click.self="qrModal = null">
        <div class="card w-full sm:max-w-xs sm:rounded-2xl rounded-t-2xl p-6 flex flex-col items-center">
          <div class="w-10 h-1 rounded-full bg-gray-200 mb-5 sm:hidden"></div>
          <p class="text-base font-black text-gray-900 mb-1 text-center">{{ qrModal.rewardName }}</p>
          <p class="text-xs text-gray-400 mb-6 text-center">出示給工作人員掃描核銷</p>
          <div class="border-2 border-gray-100 rounded-xl p-2">
            <img v-if="qrModal.dataUrl" :src="qrModal.dataUrl" alt="兌換 QR Code" class="w-52 h-52 block" />
            <div v-else class="w-52 h-52 flex items-center justify-center">
              <span class="text-xs text-gray-400">產生中…</span>
            </div>
          </div>
          <p class="text-xs text-gray-400 mt-4 text-center">核銷後此 QR 即失效</p>
          <button @click="qrModal = null" class="btn-secondary w-full mt-5">關閉</button>
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
      api.getPoints(), api.getRewards(), api.getRedemptions(), api.getQr(),
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
    successMsg.value = `成功兌換「${reward.name}」！請點「出示 QR」向工作人員核銷。`
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
  if (status === 'active') return 'text-emerald-600'
  if (status === 'used') return 'text-gray-400'
  return 'text-gray-300'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>
