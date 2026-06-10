<template>
  <AppLayout>
    <div class="max-w-lg">
      <h1 class="text-3xl font-black tracking-tight text-gray-900 mb-6">個人資料</h1>

      <div v-if="loadingProfile" class="text-center py-12 text-gray-300">載入中…</div>

      <template v-else>
        <div class="card p-6 mb-4">
          <form @submit.prevent="save" class="space-y-5">
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">姓名</label>
              <input v-model="form.name" type="text" required class="field-input" />
            </div>
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Email</label>
              <input :value="form.email" type="email" disabled class="field-input" />
            </div>
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">電話（選填）</label>
              <input v-model="form.phone" type="tel" placeholder="+886912345678" class="field-input" />
            </div>

            <div v-if="saveError" class="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">{{ saveError }}</div>
            <div v-if="saved" class="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2.5 rounded-xl">✓ 已儲存</div>

            <button type="submit" :disabled="saving" class="btn-primary">
              {{ saving ? '儲存中…' : '儲存' }}
            </button>
          </form>
        </div>

        <div class="card p-6">
          <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">帳號連結</p>

          <div v-if="linkSuccess" class="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2.5 rounded-xl mb-4">LINE 帳號綁定成功！</div>
          <div v-if="linkError" class="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl mb-4">{{ linkError }}</div>

          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="#06C755">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
              </svg>
              <span class="text-sm font-bold text-gray-800">LINE</span>
              <span v-if="lineLinked"
                class="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                已綁定
              </span>
              <span v-else class="text-xs text-gray-300">未綁定</span>
            </div>
            <button v-if="!lineLinked" @click="linkLine"
              class="text-sm font-bold px-4 py-1.5 rounded-xl text-white hover:opacity-90 transition-opacity"
              style="background-color: #06C755;">
              綁定
            </button>
          </div>
          <p v-if="!lineLinked" class="mt-3 text-xs text-gray-400">綁定後可使用 LINE 登入，也可收到最新通知。</p>
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
  if (route.query.error) linkError.value = route.query.error as string
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
    response_type: 'code', client_id: LINE_CLIENT_ID,
    redirect_uri: redirectUri, scope: 'openid profile', state,
  })
  window.location.href = `https://access.line.me/oauth2/v2.1/authorize?${params}`
}
</script>
