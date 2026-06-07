<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 w-full max-w-sm p-8">
      <h1 class="text-xl font-bold text-gray-900 mb-1">驗證 Email</h1>
      <p class="text-gray-500 text-sm mb-7">
        確認碼已寄送至<br />
        <span class="font-medium text-gray-700">{{ email }}</span>
      </p>

      <form @submit.prevent="submit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">確認碼</label>
          <input v-model="code" type="text" inputmode="numeric" pattern="[0-9]{6}"
            maxlength="6" placeholder="123456" required
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-center text-xl tracking-[0.5em] font-mono" />
        </div>

        <p v-if="error" class="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{{ error }}</p>
        <p v-if="success" class="text-green-600 text-sm bg-green-50 px-3 py-2 rounded-lg">✓ 驗證成功！正在跳轉…</p>

        <button type="submit" :disabled="loading || success"
          class="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {{ loading ? '驗證中…' : '確認' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/lib/api'

const route = useRoute()
const router = useRouter()
const email = ref('')
const code = ref('')
const error = ref('')
const success = ref(false)
const loading = ref(false)

onMounted(() => { email.value = (route.query.email as string) ?? '' })

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await api.confirm(email.value, code.value)
    success.value = true
    setTimeout(() => router.push('/login'), 1500)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '驗證失敗'
  } finally {
    loading.value = false
  }
}
</script>
