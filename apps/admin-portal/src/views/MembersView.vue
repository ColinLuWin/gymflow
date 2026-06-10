<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-6">
      <div>
        <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">管理</p>
        <h1 class="text-3xl font-black tracking-tight text-gray-900">會員管理</h1>
      </div>
      <RouterLink to="/members/new" class="btn-primary">+ 新增會員</RouterLink>
    </div>

    <div class="card overflow-hidden">
      <div v-if="loading" class="text-center py-16 text-gray-400">載入中…</div>
      <div v-else-if="error" class="text-center py-16 text-red-500 text-sm px-6">{{ error }}</div>

      <template v-else>
        <table class="data-table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>Email</th>
              <th>狀態</th>
              <th>建立日期</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="members.length === 0">
              <td colspan="5" class="text-center py-12 text-gray-300">尚無會員資料</td>
            </tr>
            <tr v-for="m in members" :key="m.sub">
              <td class="font-semibold text-gray-900">{{ m.name }}</td>
              <td class="text-gray-500">{{ m.email }}</td>
              <td>
                <span class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                  :class="m.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-600'">
                  <span class="w-1.5 h-1.5 rounded-full"
                    :class="m.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'"></span>
                  {{ m.status === 'active' ? '正常' : '停權' }}
                </span>
              </td>
              <td class="text-gray-400 text-xs">{{ formatDate(m.createdAt) }}</td>
              <td class="text-right">
                <RouterLink :to="`/members/${m.sub}`"
                  class="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                  查看 →
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="cursor" class="px-6 py-4 border-t border-gray-50 text-center">
          <button @click="loadMore" :disabled="loadingMore"
            class="text-sm font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50">
            {{ loadingMore ? '載入中…' : '載入更多' }}
          </button>
        </div>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import { api, type Member } from '@/lib/api'

const loading = ref(true)
const loadingMore = ref(false)
const error = ref('')
const members = ref<Member[]>([])
const cursor = ref<string | null>(null)

onMounted(async () => {
  try {
    const res = await api.listMembers()
    members.value = res.members
    cursor.value = res.cursor
  } catch (e: unknown) {
    error.value = (e as Error).message ?? '載入失敗，請重新整理頁面'
  } finally {
    loading.value = false
  }
})

async function loadMore() {
  if (!cursor.value) return
  loadingMore.value = true
  try {
    const res = await api.listMembers(cursor.value)
    members.value.push(...res.members)
    cursor.value = res.cursor
  } finally {
    loadingMore.value = false
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW')
}
</script>
