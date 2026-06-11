<template>
  <AppLayout>
    <div v-if="loading" class="text-center py-16 text-gray-400">載入中…</div>

    <template v-else>
      <!-- Hero member card -->
      <div class="gradient-hero rounded-3xl p-7 mb-5 relative overflow-hidden"
        style="box-shadow: 0 12px 48px rgba(79,70,229,0.45), 0 4px 12px rgba(0,0,0,0.12);">
        <div class="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none"
          style="background: rgba(255,255,255,0.07);"></div>
        <div class="absolute -bottom-12 -left-8 w-40 h-40 rounded-full pointer-events-none"
          style="background: rgba(255,255,255,0.05);"></div>

        <!-- Card top row -->
        <div class="relative flex items-start justify-between mb-10">
          <div>
            <p class="text-xs font-bold uppercase tracking-widest text-white/50 mb-1.5">Gymflow Member</p>
            <p class="text-2xl font-black text-white tracking-tight">{{ profile?.name ?? '—' }}</p>
          </div>

          <!-- QR — tap to enlarge -->
          <button @click="showQrModal = true"
            class="bg-white rounded-2xl p-2 shrink-0 shadow-lg active:scale-95 transition-transform flex flex-col items-center">
            <img v-if="qrDataUrl" :src="qrDataUrl" alt="會員 QR Code" class="w-16 h-16 block rounded-lg" />
            <div v-else class="w-16 h-16 flex items-center justify-center">
              <span class="text-xs text-gray-300">…</span>
            </div>
            <span v-if="qrDataUrl" class="text-[9px] text-gray-400 font-semibold mt-1 leading-none">點擊放大</span>
          </button>
        </div>

        <!-- Points display -->
        <div class="relative">
          <p class="text-xs font-bold uppercase tracking-widest text-white/50 mb-2">累積點數</p>
          <div class="flex items-baseline gap-3">
            <span class="text-7xl font-black text-white leading-none tracking-tight"
              style="text-shadow: 0 2px 20px rgba(0,0,0,0.15);">{{ balance }}</span>
            <span class="text-2xl font-bold text-white/40">pts</span>
          </div>
        </div>
      </div>

      <!-- CTA -->
      <RouterLink to="/rewards" class="btn-primary w-full mb-5 text-base py-4 rounded-2xl">
        前往兌換獎勵
      </RouterLink>

      <!-- Transaction history -->
      <div class="card overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-50">
          <p class="text-xs font-bold uppercase tracking-widest text-gray-400">點數異動記錄</p>
        </div>
        <template v-if="transactions.length">
          <div v-for="(txn, i) in transactions" :key="txn.SK"
            class="flex items-center justify-between px-6 py-4"
            :class="i < transactions.length - 1 ? 'border-b border-gray-50' : ''">
            <div class="flex items-center gap-4">
              <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-black"
                :class="txn.delta > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'">
                {{ txn.delta > 0 ? '+' : '−' }}
              </div>
              <div>
                <p class="text-sm font-semibold text-gray-800">{{ txnLabel(txn) }}</p>
                <p class="text-xs text-gray-400 mt-0.5">{{ formatDate(txn.createdAt) }}</p>
              </div>
            </div>
            <span class="text-base font-black"
              :class="txn.delta > 0 ? 'text-emerald-500' : 'text-red-500'">
              {{ txn.delta > 0 ? '+' : '' }}{{ txn.delta }}
            </span>
          </div>
        </template>
        <div v-else class="px-6 py-10 text-center text-sm text-gray-300">尚無異動記錄</div>
      </div>
    </template>

    <!-- QR Fullscreen Modal -->
    <Teleport to="body">
      <Transition name="qr-fade">
        <div v-if="showQrModal"
          @click="showQrModal = false"
          class="fixed inset-0 z-50 flex items-center justify-center p-6"
          style="background: rgba(15,10,40,0.82); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);">

          <div @click.stop
            class="bg-white rounded-3xl p-8 flex flex-col items-center w-full max-w-xs shadow-2xl">

            <!-- Header -->
            <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">出示掃描</p>
            <p class="text-xl font-black text-gray-900 mb-6">{{ profile?.name }}</p>

            <!-- Large QR -->
            <div class="bg-gray-50 rounded-2xl p-4">
              <img :src="qrDataUrl" alt="會員 QR Code" class="w-64 h-64 block" style="image-rendering: pixelated;" />
            </div>

            <p class="text-xs text-gray-300 mt-5">點擊任意處關閉</p>
          </div>
        </div>
      </Transition>
    </Teleport>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import QRCode from 'qrcode'
import AppLayout from '@/components/AppLayout.vue'
import { api, type PointsTxn, type Profile } from '@/lib/api'

const loading = ref(true)
const qrDataUrl = ref('')
const balance = ref(0)
const transactions = ref<PointsTxn[]>([])
const profile = ref<Profile | null>(null)
const showQrModal = ref(false)

onMounted(async () => {
  try {
    const [qr, pts, p] = await Promise.all([api.getQr(), api.getPoints(), api.getProfile()])
    balance.value = pts.balance
    transactions.value = pts.transactions
    profile.value = p
    // 高解析度生成，縮小顯示不失真，放大後也清晰
    qrDataUrl.value = await QRCode.toDataURL(qr.memberId, {
      width: 512,
      margin: 2,
    })
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

<style scoped>
.qr-fade-enter-active,
.qr-fade-leave-active {
  transition: opacity 0.2s ease;
}
.qr-fade-enter-from,
.qr-fade-leave-to {
  opacity: 0;
}
</style>
