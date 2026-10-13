<template>
  <span
    class="shrink-0 rounded-xl flex items-center justify-center text-white"
    :style="{ width: px + 'px', height: px + 'px', background: meta.bg }"
    :aria-label="meta.label"
    role="img"
  >
    <svg :width="px * 0.58" :height="px * 0.58" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <!-- 抽象占位图形。正式接入时替换为各厂商官方 logo 资源（注意商标授权） -->
      <g v-if="name === 'wecom'">
        <path d="M3.5 11.2c0-4 3.6-7.2 8-7.2s8 3.2 8 7.2-3.6 7.2-8 7.2c-.9 0-1.8-.1-2.6-.4L5 20.5l.9-3.1a6.9 6.9 0 0 1-2.4-6.2Z" />
        <circle cx="9" cy="11" r=".9" fill="currentColor" stroke="none" />
        <circle cx="14.5" cy="11" r=".9" fill="currentColor" stroke="none" />
      </g>
      <g v-else-if="name === 'dingtalk'">
        <path d="M4 3.5 18.5 8c1.2.4 1.4 1.9.4 2.6l-3.6 2.4" />
        <path d="m4 3.5 3.5 8.6 1.7-2.6" />
        <path d="M11 14.5 9.6 20l3.6-5.4" />
        <path d="M15.5 12.2 20 9.6" />
      </g>
      <g v-else-if="name === 'feishu'">
        <path d="M3 5.5h7.5v9.2c0 2-1.6 3.6-3.6 3.6H3V5.5Z" />
        <path d="M14 5.5h6.5v3.2c0 2.6-2.1 4.7-4.7 4.7H14V5.5Z" />
      </g>
      <g v-else>
        <circle cx="12" cy="12" r="9" />
      </g>
    </svg>
  </span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  name: { type: String, default: '' }, // wecom | dingtalk | feishu
  size: { type: [Number, String], default: 40 },
});

const px = computed(() => Number(props.size) || 40);

const PRESETS = {
  wecom: { label: '企业微信', bg: 'linear-gradient(135deg,#3E9BFF,#1A73E8)' },
  dingtalk: { label: '钉钉', bg: 'linear-gradient(135deg,#4DA3FF,#1268E8)' },
  feishu: { label: '飞书', bg: 'linear-gradient(135deg,#4E8BFF,#00C2A8)' },
};

const meta = computed(
  () => PRESETS[props.name] || { label: props.name, bg: 'rgb(var(--ink-300))' }
);
</script>
