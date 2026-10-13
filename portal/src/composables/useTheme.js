// portal/src/composables/useTheme.js
// 全局单例：外观模式（浅色/深色/跟随系统）+ 强调色（主题色）。
//
// 实现要点：
// 1) 强调色是「运行时」切换的 —— 编译期写死的 hex 做不到，
//    所以把 brand 色阶以 CSS 变量形式注入 <style id="accent-vars">，
//    Tailwind 侧用 rgb(var(--brand-500) / <alpha-value>) 消费（见 tailwind.config.js）。
// 2) 强调色要出「明暗两套 ramp」：浅色模式需要很浅的 tint 当底（如 brand-50），
//    同一组值搬到暗色底上会亮得刺眼；暗色模式下按钮底色反而要略提亮才有「发光」感。
// 3) 暗色模式只切 html.dark 一个类 —— ink 色阶本身也是变量，组件零改动自动翻转。
import { computed, reactive, ref } from 'vue';

const STORAGE_KEY = 'as_theme';
const STYLE_ID = 'accent-vars';

/**
 * 可选强调色。
 * 注意：这里只给「基准色」，600 档（按钮底）会被 darkenToContrast 按 WCAG 对比度反解，
 * 所以新增主题色不需要自己验算白字是否看得清 —— 原色偏亮的色会被自动压暗到达标。
 */
export const ACCENTS = [
  { key: 'apple', label: '苹果蓝', value: '#0071E3' },
  { key: 'indigo', label: '靛蓝', value: '#4F46E5' },
  { key: 'teal', label: '青碧', value: '#0891B2' },
  { key: 'green', label: '松绿', value: '#059669' },
  { key: 'orange', label: '赤橙', value: '#EA580C' },
  { key: 'violet', label: '紫罗兰', value: '#7C3AED' },
];

/** 外观模式 */
export const MODES = [
  { key: 'light', label: '浅色', icon: 'sun' },
  { key: 'dark', label: '深色', icon: 'moon' },
  { key: 'system', label: '跟随系统', icon: 'monitor' },
];

const DEFAULT_STATE = { mode: 'system', accent: 'apple' };

// ---------------------------------------------------------------- 颜色工具

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 把 base 与 target 按 ratio(0~1) 混合，返回 [r,g,b] */
function mix(baseHex, targetHex, ratio) {
  const a = hexToRgb(baseHex);
  const b = hexToRgb(targetHex);
  return a.map((v, i) => Math.round(v + (b[i] - v) * ratio));
}

const ch = (rgb) => rgb.join(' ');

/** WCAG 相对亮度 */
function relLum([r, g, b]) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** 该颜色作为背景时，白色文字的对比度 */
const contrastOnWhite = (rgb) => 1.05 / (relLum(rgb) + 0.05);

/**
 * 往黑里混合直到「白字对比度」达标，返回达标后的颜色。
 *
 * 为什么需要：primary 按钮是 brand-600 底 + 白字，而各主题色的原始亮度差异很大 ——
 * 靛蓝/紫罗兰够深（5.7~6.3），青碧/赤橙却不够（浅色 4.3~4.4、深色 3.6~3.8），
 * 固定比例的黑化/提亮无法同时覆盖两端。这里按对比度反解：
 * 已达标的保持起始色不动，不达标的压暗到刚好达标，避免「为了好看牺牲可读性」。
 *
 * @param startRatio 起始黑化比例。浅色档从 0.1 起（保持既有的深一档观感），深色档从 0 起（尽量保留饱和）。
 */
function darkenToContrast(baseHex, startRatio = 0, target = 4.6) {
  for (let r = startRatio; r <= 0.95; r = Math.round((r + 0.02) * 100) / 100) {
    const c = mix(baseHex, '#000000', r);
    if (contrastOnWhite(c) >= target) return c;
  }
  return mix(baseHex, '#000000', 0.95);
}

/** 浅色模式色阶：往白里调出 tint，往黑里调出深色档 */
function buildLightRamp(base) {
  return {
    50: ch(mix(base, '#FFFFFF', 0.94)),
    100: ch(mix(base, '#FFFFFF', 0.88)),
    200: ch(mix(base, '#FFFFFF', 0.76)),
    300: ch(mix(base, '#FFFFFF', 0.62)),
    400: ch(mix(base, '#FFFFFF', 0.18)),
    500: ch(hexToRgb(base)),
    600: ch(darkenToContrast(base, 0.1)),
    700: ch(mix(base, '#000000', 0.2)),
    800: ch(mix(base, '#000000', 0.32)),
  };
}

/**
 * 暗色模式色阶：
 * - 低档（50~300）是「当底色用的 tint」，必须压暗，否则 brand-50 在暗底上会发白刺眼；
 * - 高档（600~800）是「当按钮底 / 强调文字用的」：
 *   600 作按钮底，需要白字可读，用 darkenToContrast 动态压暗到刚好达标；
 *   700/800 继续往白里提亮，它们是暗底上的「强调文字」（badge 文字、选中项文字），要亮才看得清。
 *   —— 这也是为什么按钮的 hover 不能在暗色下直接走 700：那会变亮并击穿白字对比度，
 *   详见 AppButton 里 dark:hover 的单独处理。
 */
function buildDarkRamp(base) {
  return {
    50: ch(mix(base, '#000000', 0.86)),
    100: ch(mix(base, '#000000', 0.76)),
    200: ch(mix(base, '#000000', 0.58)),
    300: ch(mix(base, '#000000', 0.42)),
    400: ch(mix(base, '#FFFFFF', 0.1)),
    500: ch(mix(base, '#FFFFFF', 0.06)),
    600: ch(darkenToContrast(base)),
    700: ch(mix(base, '#FFFFFF', 0.32)),
    800: ch(mix(base, '#FFFFFF', 0.48)),
  };
}

function injectAccent(accentKey) {
  if (typeof document === 'undefined') return;
  const accent = ACCENTS.find((a) => a.key === accentKey) || ACCENTS[0];
  const light = buildLightRamp(accent.value);
  const dark = buildDarkRamp(accent.value);

  const block = (ramp) =>
    Object.entries(ramp)
      .map(([shade, val]) => `--brand-${shade}:${val};`)
      .join('');

  const css = `:root{${block(light)}}\nhtml.dark{${block(dark)}}`;

  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

// ---------------------------------------------------------------- 状态

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return {
      mode: MODES.some((m) => m.key === parsed.mode) ? parsed.mode : DEFAULT_STATE.mode,
      accent: ACCENTS.some((a) => a.key === parsed.accent) ? parsed.accent : DEFAULT_STATE.accent,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

const state = reactive(readState());
const systemDark = ref(false);
let mql = null;

const isDark = computed(
  () => state.mode === 'dark' || (state.mode === 'system' && systemDark.value)
);

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: state.mode, accent: state.accent }));
  } catch {
    /* 隐私模式下 localStorage 可能不可写，忽略即可 */
  }
}

/** 把当前状态落到 DOM 上 */
function apply() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', isDark.value);
  root.style.colorScheme = isDark.value ? 'dark' : 'light';
  injectAccent(state.accent);
}

/** 用户主动切换时加一层短暂过渡，避免颜色硬闪；首屏初始化不加 */
function applyAnimated() {
  const root = document.documentElement;
  root.classList.add('theme-transition');
  apply();
  window.setTimeout(() => root.classList.remove('theme-transition'), 240);
}

function watchSystem() {
  if (typeof window === 'undefined' || !window.matchMedia) return;
  mql = window.matchMedia('(prefers-color-scheme: dark)');
  systemDark.value = mql.matches;
  const onChange = (e) => {
    systemDark.value = e.matches;
    if (state.mode === 'system') applyAnimated();
  };
  if (mql.addEventListener) mql.addEventListener('change', onChange);
  else if (mql.addListener) mql.addListener(onChange);
}

let initialized = false;

/** 必须在 app.mount() 之前调用一次，避免首屏闪白 */
export function initTheme() {
  watchSystem();
  apply();
  initialized = true;
}

export function useTheme() {
  if (!initialized && typeof window !== 'undefined') initTheme();

  function setMode(mode) {
    if (!MODES.some((m) => m.key === mode)) return;
    state.mode = mode;
    persist();
    applyAnimated();
  }

  function setAccent(key) {
    if (!ACCENTS.some((a) => a.key === key)) return;
    state.accent = key;
    persist();
    applyAnimated();
  }

  /** 在 浅色 → 深色 → 跟随系统 之间循环（供快捷按钮使用） */
  function cycleMode() {
    const idx = MODES.findIndex((m) => m.key === state.mode);
    setMode(MODES[(idx + 1) % MODES.length].key);
  }

  function resetTheme() {
    state.mode = DEFAULT_STATE.mode;
    state.accent = DEFAULT_STATE.accent;
    persist();
    applyAnimated();
  }

  return {
    mode: computed(() => state.mode),
    accent: computed(() => state.accent),
    isDark,
    systemDark,
    setMode,
    setAccent,
    cycleMode,
    resetTheme,
    ACCENTS,
    MODES,
  };
}
