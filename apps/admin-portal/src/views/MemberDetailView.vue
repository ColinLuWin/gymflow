<template>
  <AppLayout>
    <div class="mb-6">
      <RouterLink to="/members" class="text-sm text-gray-500 hover:text-gray-700">← 返回列表</RouterLink>
    </div>

    <div v-if="loading" class="text-center py-16 text-gray-400">載入中…</div>

    <template v-else-if="member">
      <div class="flex items-start justify-between mb-6">
        <div>
          <h2 class="text-xl font-bold text-gray-900">{{ member.name }}</h2>
          <p class="text-sm text-gray-500 mt-1">{{ member.email }}</p>
        </div>
        <div class="flex gap-2">
          <button v-if="member.status === 'active'" @click="suspend" :disabled="acting"
            class="text-sm bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors font-medium">
            停權
          </button>
          <button v-else @click="activate" :disabled="acting"
            class="text-sm bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors font-medium">
            復權
          </button>
        </div>
      </div>

      <p v-if="actionMsg" class="mb-4 text-sm bg-blue-50 text-blue-700 px-3 py-2 rounded-lg">{{ actionMsg }}</p>

      <div class="grid gap-4 sm:grid-cols-2 mb-6">
        <div class="bg-white rounded-xl border border-gray-200 p-5">
          <p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">基本資料</p>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between">
              <dt class="text-gray-500">狀態</dt>
              <dd>
                <span :class="member.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
                  class="text-xs font-medium px-2 py-0.5 rounded-full">
                  {{ member.status === 'active' ? '正常' : '停權' }}
                </span>
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-gray-500">電話</dt>
              <dd class="text-gray-900">{{ member.phone ?? '—' }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-gray-500">建立日期</dt>
              <dd class="text-gray-900">{{ formatDate(member.createdAt) }}</dd>
            </div>
          </dl>
        </div>
      </div>

      <!-- Edit form -->
      <div class="bg-white rounded-xl border border-gray-200 p-6 max-w-lg">
        <p class="text-sm font-medium text-gray-700 mb-4">編輯資料</p>
        <form @submit.prevent="save" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">姓名</label>
            <input v-model="form.name" type="text" required
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">電話（選填）</label>
            <input v-model="form.phone" type="tel"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm" />
          </div>

          <p v-if="saveError" class="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{{ saveError }}</p>
          <p v-if="saved" class="text-green-600 text-sm bg-green-50 px-3 py-2 rounded-lg">✓ 已儲存</p>

          <button type="submit" :disabled="saving"
            class="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {{ saving ? '儲存中…' : '儲存' }}
          </button>
        </form>
      </div>
    </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import { api, type Member } from '@/lib/api'

const route = useRoute()
const id = route.params.id as string

const loading = ref(true)
const member = ref<Member | null>(null)
const form = ref({ name: '', phone: '' })

const acting = ref(false)
const actionMsg = ref('')
const saving = ref(false)
const saved = ref(false)
const saveError = ref('')

onMounted(async () => {
  const m = await api.getMember(id)
  member.value = m
  form.value.name = m.name
  form.value.phone = m.phone ?? ''
  loading.value = false
})

async function suspend() {
  acting.value = true
  try {
    await api.suspendMember(id)
    member.value!.status = 'suspended'
    actionMsg.value = '已停權'
    setTimeout(() => { actionMsg.value = '' }, 3000)
  } finally {
    acting.value = false
  }
}

async function activate() {
  acting.value = true
  try {
    await api.activateMember(id)
    member.value!.status = 'active'
    actionMsg.value = '已復權'
    setTimeout(() => { actionMsg.value = '' }, 3000)
  } finally {
    acting.value = false
  }
}

async function save() {
  saveError.value = ''
  saved.value = false
  saving.value = true
  try {
    const updated = await api.updateMember(id, {
      name: form.value.name,
      phone: form.value.phone || undefined,
    })
    member.value = updated
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : '儲存失敗'
  } finally {
    saving.value = false
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW')
}
</script>
