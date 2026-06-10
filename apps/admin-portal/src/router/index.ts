import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login',    component: () => import('@/views/LoginView.vue'),    meta: { public: true } },
    { path: '/callback', component: () => import('@/views/CallbackView.vue'), meta: { public: true } },
    { path: '/pending',  component: () => import('@/views/PendingView.vue') },
    { path: '/approvals', component: () => import('@/views/ApprovalsView.vue') },
    { path: '/members', component: () => import('@/views/MembersView.vue') },
    { path: '/members/new', component: () => import('@/views/MemberNewView.vue') },
    { path: '/members/:id', component: () => import('@/views/MemberDetailView.vue') },
    { path: '/rewards', component: () => import('@/views/RewardsView.vue') },
    { path: '/redemptions', component: () => import('@/views/RedemptionsView.vue') },
    { path: '/scan', component: () => import('@/views/ScanView.vue') },
    { path: '/', redirect: '/members' },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (!auth.isLoggedIn) {
    if (!to.meta.public) return '/login'
    return
  }

  // Authenticated but not yet approved → only /pending and /callback are allowed
  if (auth.isPendingApproval) {
    if (to.path === '/pending' || to.path === '/callback') return
    return '/pending'
  }

  // Authenticated and approved → public routes + /pending redirect to app
  if (to.meta.public || to.path === '/pending') return '/members'
})

export default router
