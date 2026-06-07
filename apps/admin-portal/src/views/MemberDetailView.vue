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

      <!-- Points section -->
      <div class="mt-6 bg-white rounded-xl border border-gray-200 p-6">
        <div class="flex items-center justify-between mb-4">
          <p class="text-sm font-medium text-gray-700">點數管理</p>
          <span class="text-2xl font-bold text-indigo-600">{{ pointsBalance }} 點</span>
        </div>

        <form @submit.prevent="awardPts" class="flex gap-3 items-end mb-5">
          <div class="flex-1">
            <label class="block text-xs font-medium text-gray-500 mb-1">發給點數</label>
            <input v-model.number="awardForm.points" type="number" min="1" required
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm" />
          </div>
          <div class="flex-[2]">
            <label class="block text-xs font-medium text-gray-500 mb-1">備註（選填）</label>
            <input v-model="awardForm.note" type="text" placeholder="例：深蹲 3 組完成"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm" />
          </div>
          <button type="submit" :disabled="awarding"
            class="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap">
            {{ awarding ? '發送中…' : '發點數' }}
          </button>
        </form>

        <p v-if="awardMsg" class="mb-3 text-sm bg-green-50 text-green-700 px-3 py-2 rounded-lg">{{ awardMsg }}</p>

        <div v-if="pointsTxns.length">
          <p class="text-xs text-gray-400 uppercase tracking-wide mb-2">最近異動</p>
          <div v-for="t in pointsTxns" :key="t.SK"
            class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
            <div>
              <p class="text-sm text-gray-700">{{ t.note ?? txnLabel(t.type) }}</p>
              <p class="text-xs text-gray-400">{{ formatDate(t.createdAt) }}</p>
            </div>
            <span :class="t.delta > 0 ? 'text-green-600' : 'text-red-500'"
              class="text-sm font-semibold">
              {{ t.delta > 0 ? '+' : '' }}{{ t.delta }}
            </span>
          </div>
        </div>
        <p v-else class="text-sm text-gray-400">尚無點數記錄</p>
      </div>

      <!-- Danger zone -->
      <div class="mt-6 max-w-lg border border-red-200 rounded-xl p-5">
        <p class="text-sm font-medium text-red-700 mb-1">危險操作</p>
        <p class="text-xs text-gray-500 mb-4">刪除後無法復原，Cognito 帳號與所有資料將一併移除。</p>
        <button @click="remove" :disabled="acting"
          class="text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium">
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

async function remove() {
  if (!confirm(`確定要刪除「${member.value!.name}」？此操作無法復原。`)) return
  acting.value = true
  try {
    await api.deleteMember(id)
    router.push('/members')
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
  } finally {
    awarding.value = false
  }
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
