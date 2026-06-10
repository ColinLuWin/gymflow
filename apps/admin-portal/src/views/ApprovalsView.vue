<template>
  <AppLayout>
    <div class="mb-6">
      <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">管理</p>
      <h1 class="text-2xl md:text-3xl font-black tracking-tight text-gray-900">審核管理</h1>
      <p class="text-gray-400 text-sm mt-1">審核教練 / 員工的後台存取申請</p>
    </div>

    <!-- Status filter -->
    <div class="flex gap-2 mb-5 flex-wrap">
      <button v-for="f in filters" :key="f.value" @click="activeFilter = f.value"
        class="text-xs font-bold px-3.5 py-1.5 rounded-full transition-colors"
        :class="activeFilter === f.value
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'">
        {{ f.label }}
        <span v-if="f.value === 'pending'" class="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px]"
          :class="activeFilter === 'pending' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'">
          {{ pendingCount }}
        </span>
      </button>
    </div>

    <div v-if="loading" class="text-center py-16 text-gray-400">載入中…</div>

    <template v-else>
      <div v-if="actionMsg" class="mb-5 text-sm text-indigo-700 bg-indigo-50 border border-indigo-100 px-4 py-3 rounded-xl">{{ actionMsg }}</div>
      <div v-if="errorMsg"  class="mb-5 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">{{ errorMsg }}</div>

      <div v-if="filteredApprovals.length" class="card overflow-hidden">
        <!-- Mobile card list -->
        <div class="md:hidden divide-y divide-gray-50">
          <div v-for="a in filteredApprovals" :key="a.sub" class="px-5 py-4">
            <div class="flex items-start justify-between mb-2">
              <div class="flex-1 min-w-0 mr-3">
                <p class="font-semibold text-gray-900 text-sm">{{ a.name }}</p>
                <p class="text-xs font-mono text-gray-400 mt-0.5 truncate">{{ a.email }}</p>
              </div>
              <span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                :class="a.status === 'pending' ? 'bg-amber-50 text-amber-700' : a.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'">
                <span class="w-1.5 h-1.5 rounded-full"
                  :class="a.status === 'pending' ? 'bg-amber-400' : a.status === 'approved' ? 'bg-emerald-500' : 'bg-red-500'"></span>
                {{ a.status === 'pending' ? '待審核' : a.status === 'approved' ? '已核准' : '已拒絕' }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <p class="text-xs text-gray-400">{{ formatDate(a.requestedAt) }}</p>
              <div v-if="a.status === 'pending'" class="flex gap-3">
                <button @click="approve(a)" :disabled="acting === a.sub"
                  class="text-xs font-semibold text-emerald-600 hover:text-emerald-800 disabled:opacity-40 transition-colors">
                  核准
                </button>
                <button @click="reject(a)" :disabled="acting === a.sub"
                  class="text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors">
                  拒絕
                </button>
              </div>
              <span v-else class="text-xs text-gray-300">
                {{ a.reviewedAt ? formatDate(a.reviewedAt) : '—' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Desktop table -->
        <div class="hidden md:block overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>Email</th>
                <th>申請時間</th>
                <th>狀態</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in filteredApprovals" :key="a.sub">
                <td class="font-semibold text-gray-900">{{ a.name }}</td>
                <td class="text-gray-500 text-xs font-mono">{{ a.email }}</td>
                <td class="text-gray-400 text-xs">{{ formatDate(a.requestedAt) }}</td>
                <td>
                  <span class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                    :class="a.status === 'pending' ? 'bg-amber-50 text-amber-700' : a.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'">
                    <span class="w-1.5 h-1.5 rounded-full"
                      :class="a.status === 'pending' ? 'bg-amber-400' : a.status === 'approved' ? 'bg-emerald-500' : 'bg-red-500'"></span>
                    {{ a.status === 'pending' ? '待審核' : a.status === 'approved' ? '已核准' : '已拒絕' }}
                  </span>
                </td>
                <td class="text-right">
                  <div v-if="a.status === 'pending'" class="flex justify-end gap-2">
                    <button @click="approve(a)" :disabled="acting === a.sub"
                      class="text-xs font-semibold text-emerald-600 hover:text-emerald-800 disabled:opacity-40 transition-colors">
                      核准
                    </button>
                    <button @click="reject(a)" :disabled="acting === a.sub"
                      class="text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors">
                      拒絕
                    </button>
                  </div>
                  <span v-else class="text-xs text-gray-300">
                    {{ a.reviewedAt ? formatDate(a.reviewedAt) : '—' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-else class="text-center py-16 text-gray-300">
        {{ activeFilter === 'pending' ? '目前沒有待審核的申請' : '沒有符合的記錄' }}
      </div>
    </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import { api, type PendingApproval } from '@/lib/api'

const loading = ref(true)
const approvals = ref<PendingApproval[]>([])
const acting = ref<string | null>(null)
const actionMsg = ref('')
const errorMsg = ref('')
const activeFilter = ref<'pending' | 'approved' | 'rejected' | 'all'>('pending')

const filters = [
  { label: '待審核', value: 'pending' as const },
  { label: '已核准', value: 'approved' as const },
  { label: '已拒絕', value: 'rejected' as const },
  { label: '全部',   value: 'all' as const },
]

const pendingCount = computed(() => approvals.value.filter((a) => a.status === 'pending').length)

const filteredApprovals = computed(() =>
  activeFilter.value === 'all'
    ? approvals.value
    : approvals.value.filter((a) => a.status === activeFilter.value)
)

onMounted(async () => {
  await load()
  loading.value = false
})

async function load() {
  const res = await api.listApprovals()
  approvals.value = res.approvals
}

async function approve(a: PendingApproval) {
  if (!confirm(`核准「${a.name}」（${a.email}）加入系統？\n他們將以「教練」權限登入後台。`)) return
  acting.value = a.sub
  errorMsg.value = ''
  try {
    await api.approveAdmin(a.sub)
    a.status = 'approved'
    a.reviewedAt = new Date().toISOString()
    flash(`已核准 ${a.name}，已加入教練群組`)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '核准失敗'
  } finally {
    acting.value = null
  }
}

async function reject(a: PendingApproval) {
  if (!confirm(`確定拒絕「${a.name}」（${a.email}）的申請？`)) return
  acting.value = a.sub
  errorMsg.value = ''
  try {
    await api.rejectAdmin(a.sub)
    a.status = 'rejected'
    a.reviewedAt = new Date().toISOString()
    flash(`已拒絕 ${a.name} 的申請`)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '拒絕失敗'
  } finally {
    acting.value = null
  }
}

function flash(msg: string) {
  actionMsg.value = msg
  setTimeout(() => { actionMsg.value = '' }, 4000)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>
