<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold text-gray-900">獎勵商品</h2>
      <button @click="showForm = !showForm"
        class="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
        + 新增商品
      </button>
    </div>

    <!-- Create form -->
    <div v-if="showForm" class="bg-white rounded-xl border border-gray-200 p-6 mb-6 max-w-lg">
      <p class="text-sm font-medium text-gray-700 mb-4">新增獎勵商品</p>
      <form @submit.prevent="createReward" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">商品名稱 *</label>
          <input v-model="form.name" type="text" required
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">說明（選填）</label>
          <input v-model="form.description" type="text"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">所需點數 *</label>
            <input v-model.number="form.pointsCost" type="number" min="1" required
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">庫存</label>
            <input v-model.number="form.stock" type="number" min="-1"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm" />
            <p class="text-xs text-gray-400 mt-1">-1 = 無限</p>
          </div>
        </div>
        <p v-if="formError" class="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{{ formError }}</p>
        <div class="flex gap-3">
          <button type="submit" :disabled="creating"
            class="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {{ creating ? '建立中…' : '建立' }}
          </button>
          <button type="button" @click="showForm = false"
            class="px-5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            取消
          </button>
        </div>
      </form>
    </div>

    <div v-if="loading" class="text-center py-16 text-gray-400">載入中…</div>

    <template v-else>
      <p v-if="actionMsg" class="mb-4 text-sm bg-blue-50 text-blue-700 px-3 py-2 rounded-lg">{{ actionMsg }}</p>

      <div v-if="rewards.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="r in rewards" :key="r.id"
          class="bg-white rounded-xl border border-gray-200 p-5">
          <div class="flex items-start justify-between mb-3">
            <div>
              <p class="font-semibold text-gray-900">{{ r.name }}</p>
              <p v-if="r.description" class="text-xs text-gray-400 mt-0.5">{{ r.description }}</p>
            </div>
            <span :class="r.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
              class="text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ml-2">
              {{ r.isActive ? '上架' : '下架' }}
            </span>
          </div>
          <div class="flex items-center justify-between text-sm mb-4">
            <span class="font-bold text-indigo-600 text-lg">{{ r.pointsCost }} 點</span>
            <span class="text-gray-400 text-xs">庫存：{{ r.stock === -1 ? '無限' : r.stock }}</span>
          </div>
          <div class="flex gap-2">
            <button @click="toggleActive(r)" :disabled="acting === r.id"
              class="flex-1 text-xs py-1.5 rounded-lg border transition-colors"
              :class="r.isActive ? 'border-gray-200 text-gray-600 hover:bg-gray-50' : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'">
              {{ r.isActive ? '下架' : '上架' }}
            </button>
            <button @click="remove(r)" :disabled="acting === r.id"
              class="flex-1 text-xs py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
              刪除
            </button>
          </div>
        </div>
      </div>
      <div v-else class="text-center py-16 text-gray-400">尚無獎勵商品</div>
    </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import { api, type Reward } from '@/lib/api'

const loading = ref(true)
const rewards = ref<Reward[]>([])
const showForm = ref(false)
const creating = ref(false)
const acting = ref<string | null>(null)
const actionMsg = ref('')
const formError = ref('')

const form = ref({ name: '', description: '', pointsCost: 100, stock: -1 })

onMounted(async () => {
  await load()
  loading.value = false
})

async function load() {
  const res = await api.listRewards()
  rewards.value = res.rewards.sort((a, b) => a.pointsCost - b.pointsCost)
}

async function createReward() {
  formError.value = ''
  creating.value = true
  try {
    await api.createReward({
      name: form.value.name,
      description: form.value.description || undefined,
      pointsCost: form.value.pointsCost,
      stock: form.value.stock,
    })
    form.value = { name: '', description: '', pointsCost: 100, stock: -1 }
    showForm.value = false
    await load()
    flash('商品已建立')
  } catch (e) {
    formError.value = e instanceof Error ? e.message : '建立失敗'
  } finally {
    creating.value = false
  }
}

async function toggleActive(r: Reward) {
  acting.value = r.id
  try {
    await api.updateReward(r.id, { isActive: !r.isActive })
    r.isActive = !r.isActive
    flash(r.isActive ? '已上架' : '已下架')
  } finally {
    acting.value = null
  }
}

async function remove(r: Reward) {
  if (!confirm(`確定刪除「${r.name}」？`)) return
  acting.value = r.id
  try {
    await api.deleteReward(r.id)
    rewards.value = rewards.value.filter((x) => x.id !== r.id)
    flash('已刪除')
  } finally {
    acting.value = null
  }
}

function flash(msg: string) {
  actionMsg.value = msg
  setTimeout(() => { actionMsg.value = '' }, 3000)
}
</script>
