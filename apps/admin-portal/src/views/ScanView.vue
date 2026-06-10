<template>
  <AppLayout>
    <div class="mb-6">
      <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">管理</p>
      <h1 class="text-3xl font-black tracking-tight text-gray-900">掃描 QR Code</h1>
      <p class="text-gray-400 text-sm mt-1">掃描會員點數 QR 或兌換獎勵 QR</p>
    </div>

    <!-- Redemption confirm panel -->
    <div v-if="redemptionScan" class="card p-6 mb-6 max-w-md">
      <div class="flex items-start justify-between mb-4">
        <p class="text-xs font-bold uppercase tracking-widest text-gray-400">核銷確認</p>
        <button @click="resetScan" class="text-xs font-semibold text-indigo-500 hover:text-indigo-700">重新掃描</button>
      </div>

      <div v-if="redemptionLoading" class="text-sm text-gray-400 py-4">查詢中…</div>
      <div v-else-if="redemptionError" class="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">{{ redemptionError }}</div>
      <template v-else-if="redemptionDetail">
        <dl class="space-y-3 mb-5">
          <div class="flex justify-between text-sm">
            <dt class="text-gray-500">商品</dt>
            <dd class="font-bold text-gray-900">{{ redemptionDetail.rewardName }}</dd>
          </div>
          <div class="flex justify-between text-sm">
            <dt class="text-gray-500">點數</dt>
            <dd class="text-gray-700">{{ redemptionDetail.pointsCost }} 點</dd>
          </div>
          <div class="flex justify-between text-sm">
            <dt class="text-gray-500">兌換時間</dt>
            <dd class="text-gray-700">{{ formatDate(redemptionDetail.redeemedAt) }}</dd>
          </div>
          <div class="flex justify-between text-sm items-center">
            <dt class="text-gray-500">狀態</dt>
            <dd>
              <span class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                :class="redemptionDetail.status === 'active'
                  ? 'bg-amber-50 text-amber-700'
                  : redemptionDetail.status === 'used'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-gray-100 text-gray-400'">
                <span class="w-1.5 h-1.5 rounded-full"
                  :class="redemptionDetail.status === 'active' ? 'bg-amber-400' : redemptionDetail.status === 'used' ? 'bg-emerald-500' : 'bg-gray-300'"></span>
                {{ redemptionDetail.status === 'active' ? '待核銷' : redemptionDetail.status === 'used' ? '已核銷' : '已撤銷' }}
              </span>
            </dd>
          </div>
        </dl>

        <div v-if="useMsg" class="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2.5 rounded-xl">{{ useMsg }}</div>

        <button v-if="redemptionDetail.status === 'active'"
          @click="markUsed" :disabled="using"
          class="btn-primary w-full">
          {{ using ? '核銷中…' : '確認核銷' }}
        </button>
        <div v-else class="text-center text-sm text-gray-300 py-2">此兌換已無法核銷</div>
      </template>
    </div>

    <div class="flex flex-col items-center max-w-sm">
      <div v-if="!redemptionScan" class="relative w-full rounded-2xl overflow-hidden bg-gray-900 aspect-square">
        <video ref="videoEl" class="w-full h-full object-cover" playsinline muted />
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div class="w-52 h-52 border-2 border-white/60 rounded-2xl"></div>
        </div>
        <div v-if="!scanning && !cameraError" class="absolute inset-0 flex items-center justify-center bg-black/70">
          <p class="text-white/70 text-sm">啟動相機中…</p>
        </div>
      </div>

      <canvas ref="canvasEl" class="hidden" />

      <p v-if="cameraError" class="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl w-full text-center">
        {{ cameraError }}
      </p>

      <p v-if="scanning && !redemptionScan" class="mt-4 text-sm text-gray-400">掃描中，請將 QR Code 對準框內…</p>

      <div class="mt-6 w-full">
        <p class="text-xs text-gray-400 text-center mb-3">或直接輸入會員 ID / 兌換代碼</p>
        <div class="flex gap-2">
          <input v-model="manualId" type="text" placeholder="貼上 ID…" class="field-input flex-1" />
          <button @click="handleQrData(manualId.trim())" :disabled="!manualId" class="btn-primary whitespace-nowrap">
            前往
          </button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import jsQR from 'jsqr'
import AppLayout from '@/components/AppLayout.vue'
import { api, type Redemption } from '@/lib/api'

const router = useRouter()
const videoEl = ref<HTMLVideoElement>()
const canvasEl = ref<HTMLCanvasElement>()
const scanning = ref(false)
const cameraError = ref('')
const manualId = ref('')

const redemptionScan = ref<{ memberId: string; redemptionId: string } | null>(null)
const redemptionDetail = ref<Redemption | null>(null)
const redemptionLoading = ref(false)
const redemptionError = ref('')
const using = ref(false)
const useMsg = ref('')

let stream: MediaStream | null = null
let rafId = 0

onMounted(async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    videoEl.value!.srcObject = stream
    await videoEl.value!.play()
    scanning.value = true
    tick()
  } catch {
    cameraError.value = '無法開啟相機，請確認已授予相機存取權限，或改用下方手動輸入。'
  }
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  stream?.getTracks().forEach((t) => t.stop())
})

function tick() {
  const v = videoEl.value
  const c = canvasEl.value
  if (!v || !c || v.readyState !== v.HAVE_ENOUGH_DATA) {
    rafId = requestAnimationFrame(tick)
    return
  }
  c.width = v.videoWidth
  c.height = v.videoHeight
  const ctx = c.getContext('2d')!
  ctx.drawImage(v, 0, 0, c.width, c.height)
  const imageData = ctx.getImageData(0, 0, c.width, c.height)
  const code = jsQR(imageData.data, c.width, c.height)
  if (code?.data) {
    stream?.getTracks().forEach((t) => t.stop())
    cancelAnimationFrame(rafId)
    scanning.value = false
    handleQrData(code.data)
    return
  }
  rafId = requestAnimationFrame(tick)
}

async function handleQrData(data: string) {
  if (!data) return

  if (data.startsWith('redemption:')) {
    const parts = data.split(':')
    const memberId = parts[1]
    const redemptionId = parts[2]
    if (!memberId || !redemptionId) {
      cameraError.value = '無效的兌換 QR Code'
      return
    }
    redemptionScan.value = { memberId, redemptionId }
    redemptionLoading.value = true
    redemptionError.value = ''
    try {
      const res = await api.getRedemption(memberId, redemptionId)
      redemptionDetail.value = res
    } catch (e) {
      redemptionError.value = e instanceof Error ? e.message : '查詢失敗'
    } finally {
      redemptionLoading.value = false
    }
    return
  }

  router.push(`/members/${data.trim()}`)
}

async function markUsed() {
  if (!redemptionScan.value || !redemptionDetail.value) return
  using.value = true
  try {
    await api.useRedemption(redemptionScan.value.memberId, redemptionScan.value.redemptionId)
    redemptionDetail.value.status = 'used'
    useMsg.value = '核銷成功！'
  } catch (e) {
    redemptionError.value = e instanceof Error ? e.message : '核銷失敗'
  } finally {
    using.value = false
  }
}

function resetScan() {
  redemptionScan.value = null
  redemptionDetail.value = null
  redemptionError.value = ''
  useMsg.value = ''
  scanning.value = false
  cameraError.value = ''
  manualId.value = ''
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then((s) => {
    stream = s
    if (videoEl.value) {
      videoEl.value.srcObject = s
      videoEl.value.play().then(() => {
        scanning.value = true
        tick()
      })
    }
  }).catch(() => {
    cameraError.value = '無法開啟相機，請改用手動輸入。'
  })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>
