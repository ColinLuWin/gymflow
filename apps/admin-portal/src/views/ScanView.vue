<template>
  <AppLayout>
    <div class="mb-6">
      <h2 class="text-xl font-bold text-gray-900">掃描會員 QR</h2>
      <p class="text-sm text-gray-500 mt-1">對準會員 App「我的點數」頁面的 QR Code</p>
    </div>

    <div class="flex flex-col items-center">
      <div class="relative w-full max-w-sm rounded-2xl overflow-hidden bg-black aspect-square">
        <video ref="videoEl" class="w-full h-full object-cover" playsinline muted />
        <!-- 對焦框 -->
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div class="w-52 h-52 border-2 border-white/70 rounded-xl"></div>
        </div>
        <div v-if="!scanning && !cameraError" class="absolute inset-0 flex items-center justify-center bg-black/60">
          <p class="text-white text-sm">啟動相機中…</p>
        </div>
      </div>

      <canvas ref="canvasEl" class="hidden" />

      <p v-if="cameraError" class="mt-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg max-w-sm text-center">
        {{ cameraError }}
      </p>

      <p v-if="scanning" class="mt-4 text-sm text-gray-400">掃描中，請將 QR Code 對準框內…</p>

      <div class="mt-6 w-full max-w-sm">
        <p class="text-xs text-gray-400 text-center mb-2">或直接輸入會員 ID</p>
        <div class="flex gap-2">
          <input v-model="manualId" type="text" placeholder="貼上會員 ID…"
            class="flex-1 rounded-lg border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
          <button @click="goToMember(manualId)" :disabled="!manualId"
            class="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium">
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

const router = useRouter()
const videoEl = ref<HTMLVideoElement>()
const canvasEl = ref<HTMLCanvasElement>()
const scanning = ref(false)
const cameraError = ref('')
const manualId = ref('')

let stream: MediaStream | null = null
let rafId = 0

onMounted(async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    })
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
    goToMember(code.data)
    return
  }
  rafId = requestAnimationFrame(tick)
}

function goToMember(id: string) {
  if (!id.trim()) return
  router.push(`/members/${id.trim()}`)
}
</script>
