<template>
  <AppLayout>
    <div v-if="loading" class="text-center py-16 text-gray-400">載入中…</div>

    <template v-else>
      <h2 class="text-xl font-bold text-gray-900 mb-6">我的點數</h2>

      <div class="grid gap-4 sm:grid-cols-2 mb-6">
        <!-- QR Code card -->
        <div class="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center">
          <p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">出示給教練掃描</p>
          <img v-if="qrDataUrl" :src="qrDataUrl" alt="會員 QR Code"
            class="w-48 h-48 rounded-lg border border-gray-100" />
          <div v-else class="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
            <span class="text-xs text-gray-400">產生中…</span>
          </div>
          <p class="text-xs text-gray-400 mt-3">{{ memberId }}</p>
        </div>

        <!-- Balance card -->
        <div class="bg-white rounded-xl border border-gray-200 p-6 flex flex-col justify-center">
          <p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">目前點數</p>
          <p class="text-5xl font-bold text-indigo-600">{{ balance }}</p>
          <p class="text-sm text-gray-400 mt-2">點</p>
          <RouterLink to="/rewards"
            class="mt-6 inline-block text-center bg-indigo-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors">
            前往兌換獎勵
          </RouterLink>
        </div>
      </div>

      <!-- Transaction history -->
      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">點數異動記錄</p>
        <template v-if="transactions.length">
          <div v-for="txn in transactions" :key="txn.SK"
            class="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
            <div>
              <p class="text-sm text-gray-800">{{ txnLabel(txn) }}</p>
              <p class="text-xs text-gray-400 mt-0.5">{{ formatDate(txn.createdAt) }}</p>
            </div>
            <span :class="txn.delta > 0 ? 'text-green-600' : 'text-red-500'"
              class="text-sm font-semibold">
              {{ txn.delta > 0 ? '+' : '' }}{{ txn.delta }}
            </span>
          </div>
        </template>
        <p v-else class="text-sm text-gray-400">尚無異動記錄</p>
      </div>
    </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import QRCode from 'qrcode'
import AppLayout from '@/components/AppLayout.vue'
import { api, type PointsTxn } from '@/lib/api'

const loading = ref(true)
const memberId = ref('')
const qrDataUrl = ref('')
const balance = ref(0)
const transactions = ref<PointsTxn[]>([])

onMounted(async () => {
  try {
    const [qr, pts] = await Promise.all([api.getQr(), api.getPoints()])
    memberId.value = qr.memberId
    balance.value = pts.balance
    transactions.value = pts.transactions
    qrDataUrl.value = await QRCode.toDataURL(qr.memberId, { width: 256, margin: 2 })
  } finally {
    loading.value = false
  }
})

function txnLabel(txn: PointsTxn) {
  if (txn.note) return txn.note
  if (txn.type === 'award') return '教練發點'
  if (txn.type === 'redeem') return '兌換獎勵'
  if (txn.type === 'refund') return '兌換撤銷補回'
  return '點數異動'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>
