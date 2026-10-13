// portal/src/composables/useSidebar.js
// 全局单例：侧栏折叠状态（桌面端）+ 移动端抽屉开关。
// 折叠状态持久化到 localStorage，刷新后保持；移动端抽屉不持久化（每次进入都是关的）。
import { computed, ref } from 'vue';

const STORAGE_KEY = 'as_sidebar';

function read() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

const collapsed = ref(read());
const mobileOpen = ref(false);
const isMobile = ref(false);

let mql = null;

function syncViewport(e) {
  isMobile.value = e.matches;
  // 从移动端切回桌面端时把抽屉收掉，否则遮罩会留在屏上
  if (!e.matches) mobileOpen.value = false;
}

if (typeof window !== 'undefined' && window.matchMedia) {
  mql = window.matchMedia('(max-width: 1023px)');
  isMobile.value = mql.matches;
  if (mql.addEventListener) mql.addEventListener('change', syncViewport);
  else if (mql.addListener) mql.addListener(syncViewport);
}

export function useSidebar() {
  function setCollapsed(v) {
    collapsed.value = !!v;
    try {
      localStorage.setItem(STORAGE_KEY, collapsed.value ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  function toggleCollapse() {
    setCollapsed(!collapsed.value);
  }

  function openMobile() {
    mobileOpen.value = true;
  }

  function closeMobile() {
    mobileOpen.value = false;
  }

  function toggleMobile() {
    mobileOpen.value = !mobileOpen.value;
  }

  // 侧栏总宽度：移动端为 0（抽屉浮在上层），桌面端随折叠状态 240 / 68
  const sidebarWidth = computed(() => (isMobile.value ? 0 : collapsed.value ? 68 : 240));

  return {
    collapsed: computed(() => collapsed.value),
    mobileOpen: computed(() => mobileOpen.value),
    isMobile,
    sidebarWidth,
    setCollapsed,
    toggleCollapse,
    openMobile,
    closeMobile,
    toggleMobile,
  };
}
