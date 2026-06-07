import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
    { path: '/register', component: () => import('@/views/RegisterView.vue'), meta: { public: true } },
    { path: '/confirm', component: () => import('@/views/ConfirmView.vue'), meta: { public: true } },
    { path: '/dashboard', component: () => import('@/views/DashboardView.vue') },
    { path: '/profile', component: () => import('@/views/ProfileView.vue') },
    { path: '/', redirect: '/dashboard' },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isLoggedIn) return '/login'
  if (to.meta.public && auth.isLoggedIn && to.path !== '/confirm') return '/dashboard'
})

export default router
