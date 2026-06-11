<template>
  <AppLayout>
    <div class="mb-6">
      <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">通知</p>
      <h1 class="text-2xl md:text-3xl font-black tracking-tight text-gray-900">LINE 推播</h1>
      <p class="text-sm text-gray-400 mt-1">傳送文字訊息給所有已綁定 LINE 的會員</p>
    </div>

    <div class="max-w-lg">
      <div class="card p-6">
        <form @submit.prevent="send" class="space-y-5">
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-xs font-bold uppercase tracking-wider text-gray-400">訊息內容</label>
              <span class="text-xs" :class="charCount > 4800 ? 'text-red-400' : 'text-gray-300'">
                {{ charCount }} / 5000
              </span>
            </div>
            <textarea
              v-model="message"
              :disabled="sending || sent"
              rows="6"
              maxlength="5000"
              placeholder="輸入要傳送給會員的訊息…"
              class="field-input resize-none"
            />
          </div>

          <div v-if="error" class="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">{{ error }}</div>

          <div v-if="sent" class="flex items-center gap-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 px-4 py-3 rounded-xl">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            已成功傳送給 {{ sentCount }} 位會員
          </div>

          <div class="flex gap-3">
            <button
              type="submit"
              :disabled="!message.trim() || sending || sent"
              class="btn-primary disabled:opacity-40"
            >
              {{ sending ? '傳送中…' : sent ? '已傳送' : '傳送' }}
            </button>
            <button
              v-if="sent"
              type="button"
              @click="reset"
              class="btn-secondary"
            >
              傳送新訊息
            </button>
          </div>
        </form>
      </div>

      <div class="mt-4 px-1">
        <p class="text-xs text-gray-400">
          只有已在個人資料頁面完成 LINE 綁定的會員才會收到推播。
          尚未綁定的會員不會收到通知，也不會顯示錯誤。
        </p>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import { api } from '@/lib/api'

const message = ref('')
const sending = ref(false)
const sent = ref(false)
const sentCount = ref(0)
const error = ref('')

const charCount = computed(() => message.value.length)

async function send() {
  error.value = ''
  sending.value = true
  try {
    const res = await api.lineBroadcast(message.value)
    sentCount.value = res.sent
    sent.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : '傳送失敗，請稍後再試'
  } finally {
    sending.value = false
  }
}

function reset() {
  message.value = ''
  sent.value = false
  sentCount.value = 0
  error.value = ''
}
</script>
