/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  // 暗色走 class 策略（html.dark），由 useTheme 统一切换。
  // 注意：绝大多数颜色已改为 CSS 变量驱动，暗色下无需逐个写 dark: 变体；
  // 保留 darkMode 是为了少数需要「非颜色差异」的场景（如渐变、透明度）。
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /**
         * 品牌 / 强调色 —— CSS 变量驱动。
         * 之所以不用硬编码色值：主题色需要运行时切换（编译期色值做不到）。
         * 变量以「R G B 通道」存放，<alpha-value> 才能让 bg-brand-500/10 这类透明度修饰符生效。
         * 变量定义见 src/style.css，运行时由 composables/useTheme.js 覆写。
         */
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
        },
        /**
         * 中性灰阶（Apple 风纯中性灰，无蓝调）—— CSS 变量驱动。
         * 浅色模式是「浅底深字」，暗色模式整条 ramp 反转成「深底浅字」，
         * 因此全站 145 处 ink-* 工具类在暗色下自动翻转，零改动。
         */
        ink: {
          50: 'rgb(var(--ink-50) / <alpha-value>)',
          100: 'rgb(var(--ink-100) / <alpha-value>)',
          200: 'rgb(var(--ink-200) / <alpha-value>)',
          300: 'rgb(var(--ink-300) / <alpha-value>)',
          400: 'rgb(var(--ink-400) / <alpha-value>)',
          500: 'rgb(var(--ink-500) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
        },
        // 发丝边框
        hairline: 'rgb(var(--hairline) / <alpha-value>)',
        // 侧栏底色
        sidebar: 'rgb(var(--sidebar) / <alpha-value>)',
        /** 卡片 / 模态 / 顶栏等「浮起面板」底色（替代 bg-white，暗色下才不会是白板） */
        panel: 'rgb(var(--panel) / <alpha-value>)',
        /** 页面画布底色 */
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        /**
         * 遮罩层专用色。不能用 ink-900：暗色模式下 ink-900 是「浅色文字色」，
         * 拿它当遮罩会变成白幕（语义反转）。遮罩在明暗两种模式下都必须是暗的。
         */
        scrim: 'rgb(var(--scrim) / <alpha-value>)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'PingFang SC',
          'Microsoft YaHei',
          'sans-serif',
        ],
      },
      // 阴影令牌化：暗色下浅阴影不可见，需要更深的投影
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'pop-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(.985)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in .25s ease-out',
        'pop-in': 'pop-in .22s cubic-bezier(.16,1,.3,1)',
        'slide-in': 'slide-in .16s ease-out',
      },
    },
  },
  plugins: [],
};
