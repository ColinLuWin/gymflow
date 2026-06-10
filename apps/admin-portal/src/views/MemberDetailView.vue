<template>
  <AppLayout>
    <div class="mb-5">
      <RouterLink to="/members" class="text-sm font-semibold text-indigo-500 hover:text-indigo-700">← 返回列表</RouterLink>
    </div>

    <div v-if="loading" class="text-center py-16 text-gray-400">載入中…</div>

    <template v-else-if="member">
      <!-- Header -->
      <div class="flex items-start justify-between mb-6">
        <div>
          <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">會員詳情</p>
          <h1 class="text-3xl font-black tracking-tight text-gray-900">{{ member.name }}</h1>
          <p class="text-gray-400 text-sm mt-1">{{ member.email }}</p>
        </div>
        <div class="flex gap-2">
          <button v-if="member.status === 'active'" @click="suspend" :disabled="acting" class="btn-danger">
            {{ acting ? '處理中…' : '停權' }}
          </button>
          <button v-else @click="activate" :disabled="acting"
            class="btn-secondary !text-emerald-700 !border-emerald-200 hover:!bg-emerald-50">
            {{ acting ? '處理中…' : '復權' }}
          </button>
        </div>
      </div>

      <div v-if="actionMsg" class="mb-5 text-sm text-indigo-700 bg-indigo-50 border border-indigo-100 px-4 py-3 rounded-xl">
        {{ actionMsg }}
      </div>

      <div class="grid gap-5 lg:grid-cols-2 mb-5">
        <!-- 基本資料 -->
        <div class="card p-6">
          <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">基本資料</p>
          <dl class="space-y-3">
            <div class="flex justify-between items-center">
              <dt class="text-sm text-gray-500">狀態</dt>
              <dd>
                <span class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                  :class="member.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'">
                  <span class="w-1.5 h-1.5 rounded-full"
                    :class="member.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'"></span>
                  {{ member.status === 'active' ? '正常' : '停權' }}
                </span>
              </dd>
            </div>
            <div class="flex justify-between text-sm">
              <dt class="text-gray-500">電話</dt>
              <dd class="text-gray-800 font-medium">{{ member.phone ?? '—' }}</dd>
            </div>
            <div class="flex justify-between text-sm">
              <dt class="text-gray-500">建立日期</dt>
              <dd class="text-gray-800 font-medium">{{ formatDate(member.createdAt) }}</dd>
            </div>
          </dl>
        </div>

        <!-- 點數卡 -->
        <div class="rounded-2xl p-6 relative overflow-hidden"
          style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 55%, #2563eb 100%); box-shadow: 0 8px 32px rgba(79,70,229,0.35);">
          <div class="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
            style="background: rgba(255,255,255,0.07);"></div>
          <p class="text-xs font-bold uppercase tracking-widest text-white/50 mb-2 relative">累積點數</p>
          <div class="flex items-baseline gap-2 relative">
            <span class="text-6xl font-black text-white leading-none tracking-tight">{{ pointsBalance }}</span>
            <span class="text-xl font-bold text-white/40">pts</span>
          </div>
          <p class="text-xs text-white/40 mt-3 relative font-medium">{{ member.name }}</p>
        </div>
      </div>

      <!-- 編輯資料 -->
      <div class="card p-6 max-w-lg mb-5">
        <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">編輯資料</p>
        <form @submit.prevent="save" class="space-y-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">姓名</label>
            <input v-model="form.name" type="text" required class="field-input" />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">電話（選填）</label>
            <input v-model="form.phone" type="tel" class="field-input" />
          </div>
          <div v-if="saveError" class="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">{{ saveError }}</div>
          <div v-if="saved" class="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2.5 rounded-xl">✓ 已儲存</div>
          <button type="submit" :disabled="saving" class="btn-primary">{{ saving ? '儲存中…' : '儲存' }}</button>
        </form>
      </div>

      <!-- 點數管理 -->
      <div class="card p-6 mb-5">
        <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">發送點數</p>
        <form @submit.prevent="awardPts" class="flex gap-3 items-end mb-5">
          <div class="w-32">
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">點數</label>
            <input v-model.number="awardForm.points" type="number" min="1" required class="field-input" />
          </div>
          <div class="flex-1">
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">備註（選填）</label>
            <input v-model="awardForm.note" type="text" placeholder="例：深蹲 3 組完成" class="field-input" />
          </div>
          <button type="submit" :disabled="awarding" class="btn-primary whitespace-nowrap">
            {{ awarding ? '發送中…' : '發點數' }}
          </button>
        </form>

        <div v-if="awardMsg" class="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2.5 rounded-xl">{{ awardMsg }}</div>

        <template v-if="pointsTxns.length">
          <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">最近異動</p>
          <div v-for="(t, i) in pointsTxns" :key="t.SK"
            class="flex items-center justify-between py-3"
            :class="i < pointsTxns.length - 1 ? 'border-b border-gray-50' : ''">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                :class="t.delta > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'">
                {{ t.delta > 0 ? '+' : '−' }}
              </div>
              <div>
                <p class="text-sm font-medium text-gray-700">{{ t.note ?? txnLabel(t.type) }}</p>
                <p class="text-xs text-gray-400">{{ formatDate(t.createdAt) }}</p>
              </div>
            </div>
            <span class="text-sm font-black" :class="t.delta > 0 ? 'text-emerald-600' : 'text-red-500'">
              {{ t.delta > 0 ? '+' : '' }}{{ t.delta }}
            </span>
          </div>
        </template>
        <p v-else class="text-sm text-gray-300">尚無點數記錄</p>
      </div>

      <!-- Danger zone -->
      <div class="max-w-lg rounded-2xl p-5 border border-red-100 bg-red-50/50">
        <p class="text-sm font-bold text-red-700 mb-1">危險操作</p>
        <p class="text-xs text-gray-500 mb-4">刪除後無法復原，Cognito 帳號與所有資料將一併移除。</p>
        <button @click="remove" :disabled="acting" class="btn-danger">
          {{ acting ? '刪除中…' : '刪除會員' }}
        </button>
      </div>
    </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import { api, type Member, type PointsTxn } from '@/lib/api'

const route = useRoute()
const router = useRouter()
const id = route.params.id as string

const loading = ref(true)
const member = ref<Member | null>(null)
const form = ref({ name: '', phone: '' })
const acting = ref(false)
const actionMsg = ref('')
const saving = ref(false)
const saved = ref(false)
const saveError = ref('')
const pointsBalance = ref(0)
const pointsTxns = ref<PointsTxn[]>([])
const awardForm = ref({ points: 10, note: '' })
const awarding = ref(false)
const awardMsg = ref('')

onMounted(async () => {
  const [m, pts] = await Promise.all([api.getMember(id), api.getMemberPoints(id)])
  member.value = m
  form.value.name = m.name
  form.value.phone = m.phone ?? ''
  pointsBalance.value = pts.balance
  pointsTxns.value = pts.transactions
  loading.value = false
})

async function suspend() {
  acting.value = true
  try {
    await api.suspendMember(id)
    member.value!.status = 'suspended'
    flash('已停權')
  } finally { acting.value = false }
}

async function activate() {
  acting.value = true
  try {
    await api.activateMember(id)
    member.value!.status = 'active'
    flash('已復權')
  } finally { acting.value = false }
}

async function remove() {
  if (!confirm(`確定要刪除「${member.value!.name}」？此操作無法復原。`)) return
  acting.value = true
  try {
    await api.deleteMember(id)
    router.push('/members')
  } finally { acting.value = false }
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
  } finally { saving.value = false }
}

async function awardPts() {
  awarding.value = true
  awardMsg.value = ''
  try {
    await api.awardPoints(id, awardForm.value.points, awardForm.value.note || undefined)
    const pts = await api.getMemberPoints(id)
    pointsBalance.value = pts.balance
    pointsTxns.value = pts.transactions
    awardMsg.value = `已發送 ${awardForm.value.points} 點`
    awardForm.value.note = ''
    setTimeout(() => { awardMsg.value = '' }, 3000)
  } finally { awarding.value = false }
}

function flash(msg: string) {
  actionMsg.value = msg
  setTimeout(() => { actionMsg.value = '' }, 3000)
}

function txnLabel(type: string) {
  if (type === 'award') return '教練發點'
  if (type === 'redeem') return '會員兌換'
  if (type === 'refund') return '兌換撤銷補回'
  return '點數異動'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>
