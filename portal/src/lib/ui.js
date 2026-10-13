// portal/src/lib/ui.js
// 控件基础样式集中定义。
//
// 之前 UsersView / LoginView 里 5 处输入框各写了一遍 focus/border 样式，
// 改一次要改五处、且必然改漏。统一收口到这里，由 AppInput / AppSelect /
// AppTextarea 复用；新增控件只需拼 controlBase + controlFocus + controlSize。
export const controlBase =
  'w-full rounded-lg border bg-panel text-ink-900 outline-none transition ' +
  'placeholder:text-ink-400 ' +
  'disabled:bg-ink-100 disabled:text-ink-400 disabled:cursor-not-allowed';

/** 统一焦点环：品牌色描边 + 柔和外环，鼠标点击不刺眼、键盘 Tab 清晰可见 */
export const controlFocus = 'focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10';

export const controlBorder = 'border-ink-300';

export const controlSize = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-3 text-sm',
  lg: 'h-11 px-3.5 text-sm',
};

/** 只读字段（如自动生成的回调地址）用弱化的底与等宽字，视觉上明确「不可编辑」 */
export const controlReadonly =
  'readonly:bg-ink-100 readonly:text-ink-500 readonly:cursor-default font-mono text-xs';
