import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from '../lib/apiBase';

const routes = [
  { path: '/login', component: () => import('../views/LoginView.vue') },
  { path: '/', component: () => import('../views/HomeView.vue') },
  {
    path: '/admin',
    component: () => import('../components/AdminLayout.vue'),
    children: [
      { path: 'users', component: () => import('../views/admin/UsersView.vue'), meta: { admin: true } },
      { path: 'roles', component: () => import('../views/admin/RolesView.vue'), meta: { admin: true } },
      { path: 'groups', component: () => import('../views/admin/GroupsView.vue'), meta: { admin: true } },
      {
        path: 'settings',
        component: () => import('../views/admin/SettingsView.vue'),
        meta: { admin: true },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach((to) => {
  const loggedIn = !!getToken();
  if (to.path !== '/login' && !loggedIn) return '/login';
  if (to.path === '/login' && loggedIn) return '/';
  if (to.meta?.admin && !loggedIn) return '/login';
  return true;
});

export default router;
