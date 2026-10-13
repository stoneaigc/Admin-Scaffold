<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="w-5 h-5"
  >
    <g v-if="name === 'users'">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </g>
    <g v-else-if="name === 'user'">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </g>
    <g v-else-if="name === 'roles'">
      <path d="M12 2 3 7v6c0 5 3.5 8 9 9 5.5-1 9-4 9-9V7l-9-5Z" />
      <path d="m9 12 2 2 4-4" />
    </g>
    <g v-else-if="name === 'groups'">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </g>
    <g v-else-if="name === 'config'">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.6 15H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9.4l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h0A1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 21 9h0a1.65 1.65 0 0 0 1.4 1V9a2 2 0 0 1 0 4Z" />
    </g>
    <g v-else-if="name === 'logout'">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </g>
    <g v-else-if="name === 'home'">
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" />
    </g>
    <g v-else-if="name === 'bell'">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </g>
    <g v-else-if="name === 'search'">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </g>
    <g v-else-if="name === 'plus'">
      <path d="M12 5v14M5 12h14" />
    </g>
    <g v-else-if="name === 'trash'">
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
    </g>
    <g v-else-if="name === 'edit'">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </g>
    <g v-else-if="name === 'check'">
      <path d="M20 6 9 17l-5-5" />
    </g>
    <g v-else-if="name === 'logo'">
      <path d="M4 19V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
      <path d="m8 12 3 3 5-6" />
    </g>
    <g v-else-if="name === 'close'">
      <path d="M18 6 6 18M6 6l12 12" />
    </g>
    <g v-else-if="name === 'arrow'">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </g>

    <!-- ===== 布局 / 主题（本次新增） ===== -->
    <g v-else-if="name === 'panel-left'">
      <rect x="3" y="3.5" width="18" height="17" rx="2.5" />
      <path d="M9.5 3.5v17" />
    </g>
    <g v-else-if="name === 'sun'">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </g>
    <g v-else-if="name === 'moon'">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </g>
    <g v-else-if="name === 'monitor'">
      <rect x="2.5" y="4" width="19" height="12.5" rx="2" />
      <path d="M8 20h8M12 16.5V20" />
    </g>
    <g v-else-if="name === 'palette'">
      <path d="M12 3a9 9 0 1 0 0 18h1.6a2.4 2.4 0 0 0 0-4.8H12a1.8 1.8 0 0 1 0-3.6h4.2A4.8 4.8 0 0 0 21 7.8C21 5.1 17 3 12 3Z" />
      <circle cx="7.8" cy="11.4" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="11" cy="7.8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.6" cy="8.6" r="1.1" fill="currentColor" stroke="none" />
    </g>
    <g v-else-if="name === 'chevron-down'">
      <path d="m6 9.5 6 6 6-6" />
    </g>
    <g v-else-if="name === 'chevron-left'">
      <path d="m14.5 6-6 6 6 6" />
    </g>
    <g v-else-if="name === 'chevron-right'">
      <path d="m9.5 6 6 6-6 6" />
    </g>

    <!-- ===== 系统设置（本次新增） ===== -->
    <g v-else-if="name === 'building'">
      <path d="M4 21V5.5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 16 5.5V21" />
      <path d="M16 10h2.5A1.5 1.5 0 0 1 20 11.5V21" />
      <path d="M2.5 21h19" />
      <path d="M7.5 8h1.5M7.5 12h1.5M7.5 16h1.5M11.5 8H13M11.5 12H13M11.5 16H13" />
    </g>
    <g v-else-if="name === 'mail'">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="m3.5 7.5 8.5 5.5 8.5-5.5" />
    </g>
    <g v-else-if="name === 'globe'">
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 9.5h17M3.5 14.5h17" />
      <path d="M12 3c2.4 2.4 3.6 5.4 3.6 9s-1.2 6.6-3.6 9c-2.4-2.4-3.6-5.4-3.6-9S9.6 5.4 12 3Z" />
    </g>
    <g v-else-if="name === 'key'">
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8-8M17 4l3 3M15 6l3 3" />
    </g>
    <g v-else-if="name === 'shield'">
      <path d="M12 2.5 4.5 6v6c0 4.6 3.2 7.4 7.5 8.5 4.3-1.1 7.5-3.9 7.5-8.5V6L12 2.5Z" />
    </g>
    <g v-else-if="name === 'image'">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="m4 17 4.5-4.5 3.5 3.5 3-2.5L20 17" />
    </g>
    <g v-else-if="name === 'upload'">
      <path d="M12 16V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
    </g>
    <g v-else-if="name === 'refresh'">
      <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
      <path d="M20.5 4.5V10h-5.5" />
    </g>
    <g v-else-if="name === 'info'">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.8v.4" />
    </g>
    <g v-else-if="name === 'external'">
      <path d="M14 4h6v6" />
      <path d="m20 4-8.5 8.5" />
      <path d="M19 14.5v4a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4 18.5v-12A1.5 1.5 0 0 1 5.5 5h4" />
    </g>
    <g v-else-if="name === 'link'">
      <path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1 1" />
      <path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1-1" />
    </g>
    <g v-else-if="name === 'menu'">
      <path d="M3.5 7h17M3.5 12h17M3.5 17h17" />
    </g>

    <circle v-else cx="12" cy="12" r="9" />
  </svg>
</template>

<script setup>
defineProps({ name: { type: String, default: '' } });
</script>
