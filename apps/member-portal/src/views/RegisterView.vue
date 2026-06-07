<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 w-full max-w-sm p-8">
      <h1 class="text-2xl font-bold text-gray-900 mb-1">Gymflow</h1>
      <p class="text-gray-500 text-sm mb-7">建立你的帳號</p>

      <form @submit.prevent="submit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">姓名</label>
          <input v-model="name" type="text" required autocomplete="name"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input v-model="email" type="email" required autocomplete="email"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">密碼</label>
          <input v-model="password" type="password" required minlength="8" autocomplete="new-password"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm" />
          <p class="text-xs text-gray-400 mt-1">至少 8 字元，含大小寫英文及數字</p>
        </div>

        <p v-if="error" class="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{{ error }}</p>

        <button type="submit" :disabled="loading"
          class="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {{ loading ? '處理中…' : '建立帳號' }}
        </button>
      </form>

      <p class="mt-6 text-xs text-center text-gray-500">
        已有帳號？
        <RouterLink to="/login" class="text-indigo-600 font-medium hover:underline">登入</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'

const router = useRouter()
const name = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await api.register(email.value, password.value, name.value)
    router.push(`/confirm?email=${encodeURIComponent(email.value)}`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '註冊失敗，請再試一次'
  } finally {
    loading.value = false
  }
}
</script>
