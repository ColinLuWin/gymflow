<template>
  <AppLayout>
    <div class="mb-5">
      <RouterLink to="/members" class="text-sm font-semibold text-indigo-500 hover:text-indigo-700">← 返回列表</RouterLink>
    </div>

    <div class="mb-6">
      <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">管理</p>
      <h1 class="text-2xl md:text-3xl font-black tracking-tight text-gray-900">新增會員</h1>
    </div>

    <div class="card p-6 max-w-lg">
      <form @submit.prevent="submit" class="space-y-5">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">姓名 <span class="text-red-400">*</span></label>
          <input v-model="form.name" type="text" required placeholder="王小明" class="field-input" />
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Email <span class="text-red-400">*</span></label>
          <input v-model="form.email" type="email" required placeholder="member@example.com" class="field-input" />
          <p class="text-xs text-gray-400 mt-1.5">系統將寄送臨時密碼至此 Email</p>
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">電話（選填）</label>
          <input v-model="form.phone" type="tel" placeholder="+886912345678" class="field-input" />
        </div>

        <div v-if="error" class="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">{{ error }}</div>
        <div v-if="successMsg" class="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 px-4 py-3 rounded-xl">{{ successMsg }}</div>

        <div class="flex gap-3 pt-1">
          <button type="submit" :disabled="loading" class="btn-primary">
            {{ loading ? '建立中…' : '建立會員' }}
          </button>
          <RouterLink to="/members" class="btn-secondary">取消</RouterLink>
        </div>
      </form>
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
