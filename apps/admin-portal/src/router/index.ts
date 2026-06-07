import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
    { path: '/members', component: () => import('@/views/MembersView.vue') },
    { path: '/members/new', component: () => import('@/views/MemberNewView.vue') },
    { path: '/members/:id', component: () => import('@/views/MemberDetailView.vue') },
    { path: '/', redirect: '/members' },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isLoggedIn) return '/login'
  if (to.meta.public && auth.isLoggedIn) return '/members'
})

export default router
