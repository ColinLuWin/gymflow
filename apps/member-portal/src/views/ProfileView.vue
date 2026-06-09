<template>
  <AppLayout>
    <div class="max-w-lg">
      <h2 class="text-xl font-bold text-gray-900 mb-6">個人資料</h2>

      <div v-if="loadingProfile" class="text-center py-12 text-gray-400">載入中…</div>

      <template v-else>
        <!-- 基本資料 -->
        <div class="bg-white rounded-xl border border-gray-200 p-6 mb-4">
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

            <p v-if="saveError" class="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{{ saveError }}</p>
            <p v-if="saved" class="text-green-600 text-sm bg-green-50 px-3 py-2 rounded-lg">✓ 已儲存</p>

            <button type="submit" :disabled="saving"
              class="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {{ saving ? '儲存中…' : '儲存' }}
            </button>
          </form>
        </div>

        <!-- LINE 帳號連結 -->
        <div class="bg-white rounded-xl border border-gray-200 p-6">
          <h3 class="text-sm font-semibold text-gray-700 mb-3">帳號連結</h3>

          <p v-if="linkSuccess" class="text-green-600 text-sm bg-green-50 px-3 py-2 rounded-lg mb-3">
            LINE 帳號綁定成功！
          </p>
          <p v-if="linkError" class="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg mb-3">{{ linkError }}</p>

          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="text-sm font-medium text-gray-700">LINE</span>
              <span v-if="lineLinked"
                class="text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
                已綁定
              </span>
              <span v-else class="text-xs text-gray-400">未綁定</span>
            </div>
            <button v-if="!lineLinked" @click="linkLine"
              class="text-sm font-medium px-4 py-1.5 rounded-lg text-white transition-colors"
              style="background-color: #06C755;">
              綁定 LINE
            </button>
          </div>
          <p v-if="!lineLinked" class="mt-2 text-xs text-gray-400">
            綁定後可使用 LINE 登入，也可收到最新通知。
          </p>
        </div>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import { api } from '@/lib/api'

const LINE_CLIENT_ID = import.meta.env.VITE_LINE_CLIENT_ID as string

const route          = useRoute()
const form           = ref({ name: '', email: '', phone: '' })
const lineLinked     = ref(false)
const loadingProfile = ref(true)
const saving         = ref(false)
const saveError      = ref('')
const saved          = ref(false)
const linkSuccess    = ref(false)
const linkError      = ref('')

onMounted(async () => {
  try {
    const p = await api.getProfile()
    form.value.name  = p.name
    form.value.email = p.email ?? ''
    form.value.phone = p.phone ?? ''
    lineLinked.value = !!p.lineUserId
  } finally {
    loadingProfile.value = false
  }

  if (route.query.linked === 'true') {
    lineLinked.value  = true
    linkSuccess.value = true
    setTimeout(() => { linkSuccess.value = false }, 4000)
  }
  if (route.query.error) {
    linkError.value = route.query.error as string
  }
})

async function save() {
  saveError.value = ''
  saved.value = false
  saving.value = true
  try {
    await api.updateProfile({ name: form.value.name, phone: form.value.phone || undefined })
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : '儲存失敗'
  } finally {
    saving.value = false
  }
}

function linkLine() {
  const state = crypto.randomUUID()
  sessionStorage.setItem('line_link_state', state)
  const redirectUri = `${window.location.origin}/link-callback`
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     LINE_CLIENT_ID,
    redirect_uri:  redirectUri,
    scope:         'openid profile',
    state,
  })
  window.location.href = `https://access.line.me/oauth2/v2.1/authorize?${params}`
}
</script>
