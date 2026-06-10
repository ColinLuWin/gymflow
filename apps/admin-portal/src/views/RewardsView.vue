<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-6">
      <div>
        <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">管理</p>
        <h1 class="text-2xl md:text-3xl font-black tracking-tight text-gray-900">獎勵商品</h1>
      </div>
      <button @click="showForm = !showForm" class="btn-primary">+ 新增商品</button>
    </div>

    <!-- Create form -->
    <div v-if="showForm" class="card p-6 mb-6 max-w-lg">
      <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">新增獎勵商品</p>
      <form @submit.prevent="createReward" class="space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">商品名稱 <span class="text-red-400">*</span></label>
          <input v-model="form.name" type="text" required class="field-input" />
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">說明（選填）</label>
          <input v-model="form.description" type="text" class="field-input" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">所需點數 <span class="text-red-400">*</span></label>
            <input v-model.number="form.pointsCost" type="number" min="1" required class="field-input" />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">庫存</label>
            <input v-model.number="form.stock" type="number" min="-1" class="field-input" />
            <p class="text-xs text-gray-400 mt-1.5">-1 = 無限</p>
          </div>
        </div>
        <div v-if="formError" class="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">{{ formError }}</div>
        <div class="flex gap-3">
          <button type="submit" :disabled="creating" class="btn-primary">{{ creating ? '建立中…' : '建立' }}</button>
          <button type="button" @click="showForm = false" class="btn-secondary">取消</button>
        </div>
      </form>
    </div>

    <div v-if="loading" class="text-center py-16 text-gray-400">載入中…</div>

    <template v-else>
      <div v-if="actionMsg" class="mb-5 text-sm text-indigo-700 bg-indigo-50 border border-indigo-100 px-4 py-3 rounded-xl">{{ actionMsg }}</div>

      <div v-if="rewards.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="r in rewards" :key="r.id" class="card p-5">
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1 min-w-0">
              <p class="font-bold text-gray-900 truncate">{{ r.name }}</p>
              <p v-if="r.description" class="text-xs text-gray-400 mt-0.5 truncate">{{ r.description }}</p>
            </div>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ml-2"
              :class="r.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'">
              {{ r.isActive ? '上架' : '下架' }}
            </span>
          </div>
          <div class="flex items-baseline justify-between mb-4">
            <span class="text-2xl font-black tracking-tight"
              style="background: linear-gradient(135deg,#4f46e5,#7c3aed); -webkit-background-clip:text; -webkit-text-fill-color:transparent;">
              {{ r.pointsCost }}
            </span>
            <span class="text-xs font-bold text-gray-300 uppercase tracking-wider">pts</span>
            <span class="text-xs text-gray-400 ml-auto">庫存：{{ r.stock === -1 ? '無限' : r.stock }}</span>
          </div>
          <div class="flex gap-2">
            <button @click="toggleActive(r)" :disabled="acting === r.id"
              class="flex-1 text-xs py-2 rounded-xl border font-semibold transition-colors disabled:opacity-40"
              :class="r.isActive
                ? 'border-gray-200 text-gray-500 hover:bg-gray-50'
                : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'">
              {{ r.isActive ? '下架' : '上架' }}
            </button>
            <button @click="remove(r)" :disabled="acting === r.id"
              class="flex-1 text-xs py-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 font-semibold transition-colors disabled:opacity-40">
              刪除
            </button>
          </div>
        </div>
      </div>
      <div v-else class="text-center py-16 text-gray-300">尚無獎勵商品</div>
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
