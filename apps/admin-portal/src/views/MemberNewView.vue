<template>
  <AppLayout>
    <div class="mb-6">
      <RouterLink to="/members" class="text-sm text-gray-500 hover:text-gray-700">← 返回列表</RouterLink>
    </div>

    <div class="max-w-lg">
      <h2 class="text-xl font-bold text-gray-900 mb-6">新增會員</h2>

      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <form @submit.prevent="submit" class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">姓名 <span class="text-red-500">*</span></label>
            <input v-model="form.name" type="text" required
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email <span class="text-red-500">*</span></label>
            <input v-model="form.email" type="email" required
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm" />
            <p class="text-xs text-gray-400 mt-1">系統將寄送臨時密碼至此 Email</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">電話（選填）</label>
            <input v-model="form.phone" type="tel" placeholder="+886912345678"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm" />
          </div>

          <p v-if="error" class="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{{ error }}</p>
          <p v-if="successMsg" class="text-green-700 text-sm bg-green-50 px-3 py-2 rounded-lg">{{ successMsg }}</p>

          <div class="flex gap-3">
            <button type="submit" :disabled="loading"
              class="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {{ loading ? '建立中…' : '建立會員' }}
            </button>
            <RouterLink to="/members"
              class="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-300 transition-colors">
              取消
            </RouterLink>
          </div>
        </form>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import { api } from '@/lib/api'

const router = useRouter()
const form = ref({ name: '', email: '', phone: '' })
const loading = ref(false)
const error = ref('')
const successMsg = ref('')

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const res = await api.createMember({
      email: form.value.email,
      name: form.value.name,
      phone: form.value.phone || undefined,
    })
    successMsg.value = `${res.message} 正在跳轉…`
    setTimeout(() => router.push(`/members/${res.sub}`), 1500)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '建立失敗'
  } finally {
    loading.value = false
  }
}
</script>
