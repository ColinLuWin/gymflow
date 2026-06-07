<template>
  <AppLayout>
    <div class="max-w-lg">
      <h2 class="text-xl font-bold text-gray-900 mb-6">個人資料</h2>

      <div v-if="loadingProfile" class="text-center py-12 text-gray-400">載入中…</div>

      <div v-else class="bg-white rounded-xl border border-gray-200 p-6">
        <form @submit.prevent="save" class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">姓名</label>
            <input v-model="form.name" type="text" required
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input :value="form.email" type="email" disabled
              class="w-full rounded-lg border-gray-200 bg-gray-50 text-gray-400 text-sm cursor-not-allowed" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">電話（選填）</label>
            <input v-model="form.phone" type="tel" placeholder="+886912345678"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm" />
          </div>

          <p v-if="error" class="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{{ error }}</p>
          <p v-if="saved" class="text-green-600 text-sm bg-green-50 px-3 py-2 rounded-lg">✓ 已儲存</p>

          <button type="submit" :disabled="saving"
            class="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {{ saving ? '儲存中…' : '儲存' }}
          </button>
        </form>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import { api } from '@/lib/api'

const form = ref({ name: '', email: '', phone: '' })
const loadingProfile = ref(true)
const saving = ref(false)
const error = ref('')
const saved = ref(false)

onMounted(async () => {
  try {
    const p = await api.getProfile()
    form.value.name = p.name
    form.value.email = p.email
    form.value.phone = p.phone ?? ''
  } finally {
    loadingProfile.value = false
  }
})

async function save() {
  error.value = ''
  saved.value = false
  saving.value = true
  try {
    await api.updateProfile({
      name: form.value.name,
      phone: form.value.phone || undefined,
    })
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '儲存失敗'
  } finally {
    saving.value = false
  }
}
</script>
