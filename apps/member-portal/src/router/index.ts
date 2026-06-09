import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login',         component: () => import('@/views/LoginView.vue'),        meta: { public: true } },
    { path: '/callback',      component: () => import('@/views/CallbackView.vue'),     meta: { public: true } },
    { path: '/link-callback', component: () => import('@/views/LinkCallbackView.vue'), meta: { public: true } },
    { path: '/dashboard',     component: () => import('@/views/DashboardView.vue') },
    { path: '/profile',       component: () => import('@/views/ProfileView.vue') },
    { path: '/points',        component: () => import('@/views/PointsView.vue') },
    { path: '/rewards',       component: () => import('@/views/RewardsView.vue') },
    { path: '/',              redirect: '/dashboard' },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isLoggedIn) return '/login'
  if (to.path === '/login' && auth.isLoggedIn) return '/dashboard'
})

export default router
