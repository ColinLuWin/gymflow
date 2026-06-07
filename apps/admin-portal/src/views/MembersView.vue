<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold text-gray-900">會員管理</h2>
      <RouterLink to="/members/new"
        class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
        + 新增會員
      </RouterLink>
    </div>

    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div v-if="loading" class="text-center py-16 text-gray-400">載入中…</div>

      <div v-else-if="error" class="text-center py-16 text-red-500 text-sm">{{ error }}</div>

      <template v-else>
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">姓名</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">狀態</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">建立日期</th>
              <th class="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="members.length === 0">
              <td colspan="5" class="px-6 py-12 text-center text-sm text-gray-400">尚無會員資料</td>
            </tr>
            <tr v-for="m in members" :key="m.sub" class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-4 text-sm font-medium text-gray-900">{{ m.name }}</td>
              <td class="px-6 py-4 text-sm text-gray-500">{{ m.email }}</td>
              <td class="px-6 py-4">
                <span :class="m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
                  class="text-xs font-medium px-2.5 py-1 rounded-full">
                  {{ m.status === 'active' ? '正常' : '停權' }}
                </span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-400">{{ formatDate(m.createdAt) }}</td>
              <td class="px-6 py-4 text-right">
                <RouterLink :to="`/members/${m.sub}`"
                  class="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                  查看
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="cursor" class="px-6 py-4 border-t border-gray-100 text-center">
          <button @click="loadMore" :disabled="loadingMore"
            class="text-sm text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50">
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
