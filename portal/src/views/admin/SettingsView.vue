<template>
  <div>
    <PageHeader title="系统设置" subtitle="系统级配置：品牌信息、外观主题、邮件服务与第三方登录">
      <template #actions>
        <AppButton variant="secondary" @click="onReset">恢复默认</AppButton>
        <AppButton :disabled="saving" @click="onSave">
          <AppSpinner v-if="saving" :size="14" />
          {{ saving ? '保存中…' : '保存更改' }}
        </AppButton>
      </template>
    </PageHeader>

    <AppTabs v-model="tab" :items="TABS" class="mb-5" />

    <!-- 状态提示：区分「已生效」与「UI 占位待接入」，避免让人误以为已经接好后端 -->
    <div
      v-if="toast || note"
      class="mb-4 flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs leading-relaxed"
      :class="toast ? toneCls[toast.tone] : toneCls[note.tone]"
    >
      <AppIcon name="info" class="w-4 h-4 shrink-0 mt-px" />
      <p>{{ toast ? toast.text : note.text }}</p>
    </div>

    <!-- ==================== 基础信息 ==================== -->
    <div v-show="tab === 'brand'" class="grid gap-5 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <AppCard title="品牌信息" desc="保存后立即作用于侧栏、登录页与浏览器标签">
          <div class="space-y-4">
            <AppField label="系统名称" required hint="显示在侧栏顶部、登录页主标题与浏览器标题">
              <AppInput v-model="form.brand.name" placeholder="例如：飞致云控制台" />
            </AppField>

            <div class="grid sm:grid-cols-2 gap-4">
              <AppField label="系统简称" hint="favicon 与窄屏场景使用，建议 1–4 字符">
                <AppInput v-model="form.brand.shortName" placeholder="AS" />
              </AppField>
              <AppField label="登录页欢迎语">
                <AppInput v-model="form.brand.welcome" placeholder="欢迎回来" />
              </AppField>
            </div>

            <AppField label="系统描述" hint="登录页副标题与系统介绍处使用">
              <AppTextarea v-model="form.brand.description" :rows="2" />
            </AppField>

            <AppField label="Logo" hint="建议 SVG 或 PNG，1:1 比例，小于 300KB">
              <div class="flex items-center gap-3">
                <span
                  class="w-11 h-11 rounded-lg border border-ink-200 bg-ink-50 flex items-center justify-center overflow-hidden shrink-0"
                >
                  <img
                    v-if="form.brand.logo"
                    :src="form.brand.logo"
                    alt="Logo 预览"
                    class="w-full h-full object-contain"
                  />
                  <AppIcon v-else name="logo" class="w-5 h-5 text-ink-400" />
                </span>
                <AppButton variant="secondary" size="sm" @click="fileInput?.click()">
                  <AppIcon name="upload" class="w-4 h-4" />上传图片
                </AppButton>
                <AppButton
                  v-if="form.brand.logo"
                  variant="ghost"
                  size="sm"
                  @click="form.brand.logo = ''"
                >
                  移除
                </AppButton>
                <input
                  ref="fileInput"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="onPickLogo"
                />
              </div>
            </AppField>

            <AppField label="页脚版权" hint="留空则不显示">
              <AppInput v-model="form.brand.footer" placeholder="© 2026 公司名称" />
            </AppField>
          </div>
        </AppCard>
      </div>

      <div>
        <AppCard title="实时预览" desc="未保存的改动也会先在这里反映">
          <div class="rounded-lg border border-ink-200 overflow-hidden">
            <div class="bg-sidebar border-b border-hairline px-3 py-2.5 flex items-center gap-2">
              <img
                v-if="form.brand.logo"
                :src="form.brand.logo"
                alt=""
                class="w-6 h-6 rounded-md object-contain"
              />
              <span
                v-else
                class="w-6 h-6 rounded-md bg-brand-600 flex items-center justify-center text-white"
              >
                <AppIcon name="logo" class="w-3.5 h-3.5" />
              </span>
              <span class="text-xs font-semibold text-ink-900 truncate">{{ form.brand.name || '未命名系统' }}</span>
            </div>
            <div class="bg-ink-50 px-3 py-3">
              <div class="flex items-center gap-2 text-[11px] text-ink-500">
                <span class="w-3.5 h-3.5 rounded bg-brand-50 border border-brand-200"></span>
                侧栏导航项
              </div>
              <div class="flex items-center gap-2 text-[11px] text-ink-500 mt-2">
                <span class="w-3.5 h-3.5 rounded bg-ink-100"></span>
                次级导航项
              </div>
            </div>
          </div>

          <div class="mt-4 rounded-lg border border-ink-200 bg-panel p-4">
            <p class="text-[11px] text-ink-500 mb-2">登录页</p>
            <div class="flex items-center gap-2 mb-3">
              <img
                v-if="form.brand.logo"
                :src="form.brand.logo"
                alt=""
                class="w-7 h-7 rounded-lg object-contain"
              />
              <span
                v-else
                class="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-white"
              >
                <AppIcon name="logo" class="w-4 h-4" />
              </span>
              <span class="text-sm font-semibold text-ink-900 truncate">{{ form.brand.name || '未命名系统' }}</span>
            </div>
            <p class="text-sm font-semibold text-ink-900">{{ form.brand.welcome || '欢迎回来' }}</p>
            <p class="text-xs text-ink-500 mt-1 leading-relaxed line-clamp-2">{{ form.brand.description }}</p>
            <div class="mt-3 h-7 rounded-lg bg-ink-100"></div>
            <div class="mt-2 h-7 rounded-lg bg-brand-600"></div>
          </div>
        </AppCard>
      </div>
    </div>

    <!-- ==================== 外观主题 ==================== -->
    <div v-show="tab === 'appearance'" class="space-y-5">
      <AppCard title="外观模式" desc="深色模式基于 CSS 变量实现，切换即时生效">
        <div class="grid sm:grid-cols-3 gap-3">
          <button
            v-for="m in MODES"
            :key="m.key"
            type="button"
            class="flex items-start gap-3 p-3.5 rounded-lg border text-left transition"
            :class="
              mode === m.key
                ? 'border-brand-500 bg-brand-50'
                : 'border-ink-200 hover:bg-ink-100'
            "
            :aria-pressed="mode === m.key ? 'true' : 'false'"
            @click="setMode(m.key)"
          >
            <AppIcon
              :name="m.icon"
              class="w-5 h-5 shrink-0 mt-0.5"
              :class="mode === m.key ? 'text-brand-700' : 'text-ink-400'"
            />
            <span class="min-w-0">
              <span class="block text-sm font-medium" :class="mode === m.key ? 'text-brand-700' : 'text-ink-900'">
                {{ m.label }}
              </span>
              <span class="block text-xs text-ink-500 mt-0.5">{{ MODE_DESC[m.key] }}</span>
            </span>
          </button>
        </div>
      </AppCard>

      <AppCard title="主题色" desc="用于按钮、选中态、链接与焦点环；深浅模式下各有一套色阶">
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            v-for="a in ACCENTS"
            :key="a.key"
            type="button"
            class="flex items-center gap-2.5 p-2.5 rounded-lg border transition text-left"
            :class="accent === a.key ? 'border-ink-300 bg-ink-100' : 'border-ink-200 hover:bg-ink-100'"
            :aria-pressed="accent === a.key ? 'true' : 'false'"
            @click="setAccent(a.key)"
          >
            <span
              class="w-6 h-6 rounded-full shrink-0 flex items-center justify-center"
              :style="{ background: a.value }"
            >
              <AppIcon v-if="accent === a.key" name="check" class="w-3.5 h-3.5 text-white" />
            </span>
            <span class="text-xs text-ink-700 truncate">{{ a.label }}</span>
          </button>
        </div>
      </AppCard>

      <AppCard title="界面偏好">
        <div class="divide-y divide-ink-100">
          <div class="flex items-center justify-between gap-4 py-3 first:pt-0">
            <div>
              <p class="text-sm text-ink-900">默认收起侧栏</p>
              <p class="text-xs text-ink-500 mt-0.5">开启后进入后台时侧栏为图标态（保存到浏览器本地）</p>
            </div>
            <AppSwitch
              :model-value="collapsed"
              aria-label="默认收起侧栏"
              @update:model-value="setCollapsed"
            />
          </div>

          <div class="flex items-center justify-between gap-4 py-3">
            <div>
              <p class="text-sm text-ink-900 flex items-center gap-2">
                界面密度
                <AppBadge color="amber">待接入</AppBadge>
              </p>
              <p class="text-xs text-ink-500 mt-0.5">紧凑 / 标准 / 宽松，影响行高与间距</p>
            </div>
            <div class="w-36 shrink-0">
              <AppSelect v-model="form.density" disabled :options="DENSITY_OPTIONS" size="sm" />
            </div>
          </div>

          <div class="flex items-center justify-between gap-4 py-3">
            <div>
              <p class="text-sm text-ink-900 flex items-center gap-2">
                圆角风格
                <AppBadge color="amber">待接入</AppBadge>
              </p>
              <p class="text-xs text-ink-500 mt-0.5">影响卡片、按钮与输入框的圆角半径</p>
            </div>
            <div class="w-36 shrink-0">
              <AppSelect v-model="form.radius" disabled :options="RADIUS_OPTIONS" size="sm" />
            </div>
          </div>
        </div>
      </AppCard>
    </div>

    <!-- ==================== 邮件配置 ==================== -->
    <div v-show="tab === 'email'" class="space-y-5">
      <AppCard title="邮件服务" desc="用于发送通知、邀请与密码重置邮件">
        <template #actions>
          <AppSwitch v-model="form.email.enabled" aria-label="启用邮件服务" />
        </template>

        <div class="grid sm:grid-cols-2 gap-4">
          <AppField label="SMTP 服务器" hint="例如 smtp.exmail.qq.com">
            <AppInput v-model="form.email.host" placeholder="smtp.example.com" />
          </AppField>
          <AppField label="端口" hint="SSL 常用 465，STARTTLS 常用 587">
            <AppInput v-model="form.email.port" placeholder="465" />
          </AppField>
          <AppField label="加密方式">
            <AppSelect v-model="form.email.encryption" :options="ENCRYPTION_OPTIONS" />
          </AppField>
          <AppField label="发件人邮箱" hint="同时也是登录 SMTP 的账号">
            <AppInput v-model="form.email.from" placeholder="noreply@example.com" />
          </AppField>
          <AppField label="发件人名称" hint="收件人看到的「发件人」显示名">
            <AppInput v-model="form.email.fromName" placeholder="系统通知" />
          </AppField>
          <AppField label="SMTP 用户名" hint="多数服务商与发件人邮箱一致">
            <AppInput v-model="form.email.username" placeholder="noreply@example.com" />
          </AppField>
          <AppField
            label="SMTP 密码 / 授权码"
            :hint="emailSaved ? '已加密保存；留空表示不改，填新的才覆盖' : '加密后落库，不会明文存储'"
          >
            <AppInput
              v-model="form.email.password"
              type="password"
              :placeholder="emailSaved ? '已保存，留空则不修改' : '••••••••'"
            />
          </AppField>
        </div>
      </AppCard>

      <AppCard title="连通性测试" desc="真发一封邮件验证 SMTP；改完没保存也能先测（用当前表单配置）">
        <div class="flex flex-wrap items-end gap-3">
          <div class="w-full sm:w-72">
            <AppField label="测试收件人">
              <AppInput v-model="testTo" placeholder="you@example.com" @keyup.enter="onTestEmail" />
            </AppField>
          </div>
          <AppButton variant="secondary" :disabled="testing" @click="onTestEmail">
            <AppSpinner v-if="testing" :size="16" />
            <AppIcon v-else name="mail" class="w-4 h-4" />
            {{ testing ? '发送中…' : '发送测试邮件' }}
          </AppButton>
          <span class="text-xs text-ink-500 pb-2.5">
            <template v-if="emailLoading">读取已保存配置…</template>
            <template v-else-if="emailSaved">服务端已保存过 SMTP 密码</template>
            <template v-else>尚未配置 SMTP 密码</template>
          </span>
        </div>
      </AppCard>
    </div>

    <!-- ==================== 第三方登录 ==================== -->
    <div v-show="tab === 'oauth'" class="space-y-5">
      <AppCard
        title="第三方登录"
        desc="启用后登录页会展示对应入口；未启用的方式不会出现在登录页"
      >
        <div class="space-y-3">
          <div
            v-for="p in PROVIDERS"
            :key="p.key"
            class="rounded-xl border transition-colors"
            :class="
              form.oauth[p.key].enabled ? 'border-brand-200 bg-brand-50/40' : 'border-ink-200'
            "
          >
            <div class="flex items-start gap-3.5 p-4">
              <ProviderLogo :name="p.key" :size="40" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-ink-900 flex items-center gap-2">
                  {{ p.name }}
                  <AppBadge v-if="form.oauth[p.key].enabled" color="brand" dot>已启用</AppBadge>
                </p>
                <p class="text-xs text-ink-500 mt-1 leading-relaxed">{{ p.desc }}</p>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <AppSwitch
                  v-model="form.oauth[p.key].enabled"
                  :aria-label="`启用${p.name}登录`"
                />
                <AppButton
                  variant="secondary"
                  size="sm"
                  @click="openProvider = openProvider === p.key ? '' : p.key"
                >
                  {{ openProvider === p.key ? '收起' : '配置' }}
                  <AppIcon
                    :name="openProvider === p.key ? 'chevron-down' : 'chevron-right'"
                    class="w-3.5 h-3.5"
                  />
                </AppButton>
              </div>
            </div>

            <div v-if="openProvider === p.key" class="border-t border-ink-200 p-4 pt-4 space-y-4">
              <div class="grid sm:grid-cols-2 gap-4">
                <AppField
                  v-for="f in p.fields"
                  :key="f.key"
                  :label="f.label"
                  :hint="f.hint"
                  :badge="f.optional ? '可选' : ''"
                >
                  <AppInput
                    v-model="form.oauth[p.key][f.key]"
                    :type="f.type || 'text'"
                    :placeholder="f.placeholder || ''"
                  />
                </AppField>
              </div>

              <AppField label="回调地址" hint="需在厂商后台把该地址加入白名单/重定向 URI">
                <div class="flex items-center gap-2">
                  <AppInput :model-value="callbackUrl(p.key)" readonly />
                  <AppButton variant="secondary" size="sm" @click="copy(callbackUrl(p.key))">
                    复制
                  </AppButton>
                </div>
              </AppField>

              <p class="text-xs text-ink-500 leading-relaxed">
                接入提示：授权成功后由后端以
                <code class="px-1 py-0.5 rounded bg-ink-100 text-ink-600">provider + external_id</code>
                写入
                <code class="px-1 py-0.5 rounded bg-ink-100 text-ink-600">user_identities</code>
                ，未绑定账号走「首次登录绑定」流程。
              </p>
            </div>
          </div>
        </div>
      </AppCard>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '../../lib/apiBase';
import PageHeader from '../../components/ui/PageHeader.vue';
import AppCard from '../../components/ui/AppCard.vue';
import AppField from '../../components/ui/AppField.vue';
import AppInput from '../../components/ui/AppInput.vue';
import AppSelect from '../../components/ui/AppSelect.vue';
import AppTextarea from '../../components/ui/AppTextarea.vue';
import AppSwitch from '../../components/ui/AppSwitch.vue';
import AppTabs from '../../components/ui/AppTabs.vue';
import AppButton from '../../components/ui/AppButton.vue';
import AppBadge from '../../components/ui/AppBadge.vue';
import AppIcon from '../../components/ui/AppIcon.vue';
import AppSpinner from '../../components/ui/AppSpinner.vue';
import ProviderLogo from '../../components/ui/ProviderLogo.vue';
import { useBrand, DEFAULT_BRAND, saveBrandToServer } from '../../composables/useBrand';
import { useTheme } from '../../composables/useTheme';
import { useSidebar } from '../../composables/useSidebar';

const { brand, readLogoFile } = useBrand();
const { mode, accent, setMode, setAccent, ACCENTS, MODES } = useTheme();
const { collapsed, setCollapsed } = useSidebar();

const tab = ref('brand');
const TABS = [
  { key: 'brand', label: '基础信息', icon: 'building' },
  { key: 'appearance', label: '外观主题', icon: 'palette' },
  { key: 'email', label: '邮件配置', icon: 'mail' },
  { key: 'oauth', label: '第三方登录', icon: 'key', badge: '3' },
];

const MODE_DESC = {
  light: '始终使用浅色界面',
  dark: '始终使用深色界面',
  system: '跟随操作系统设置自动切换',
};

const ENCRYPTION_OPTIONS = [
  { value: 'ssl', label: 'SSL / TLS' },
  { value: 'starttls', label: 'STARTTLS' },
  { value: 'none', label: '不加密' },
];
const DENSITY_OPTIONS = [
  { value: 'compact', label: '紧凑' },
  { value: 'standard', label: '标准' },
  { value: 'loose', label: '宽松' },
];
const RADIUS_OPTIONS = [
  { value: 'sm', label: '小（4px）' },
  { value: 'md', label: '中（8px）' },
  { value: 'lg', label: '大（12px）' },
];

/**
 * 第三方登录 Provider 定义。
 * 注意：这里只声明「要展示哪些字段」，不含任何厂商 SDK / 协议实现 —— 纯 UI 占位。
 */
const PROVIDERS = [
  {
    key: 'wecom',
    name: '企业微信',
    desc: '企业微信扫码登录，可自动同步通讯录与组织架构',
    fields: [
      { key: 'corpId', label: 'CorpID', hint: '企业微信「我的企业」→ 企业ID', placeholder: 'ww********' },
      { key: 'agentId', label: 'AgentID', hint: '自建应用 AgentId', placeholder: '1000002' },
      { key: 'secret', label: 'Secret', type: 'password', hint: '自建应用 Secret，注意保密' },
      { key: 'visibleRange', label: '可见范围', hint: '留空表示全员可见', placeholder: '全体成员', optional: true },
    ],
  },
  {
    key: 'dingtalk',
    name: '钉钉',
    desc: '钉钉扫码登录，适配企业内部组织架构',
    fields: [
      { key: 'appKey', label: 'Client ID（AppKey）', hint: '钉钉开放平台应用凭证', placeholder: 'ding****' },
      { key: 'appSecret', label: 'Client Secret', type: 'password', hint: '应用密钥，注意保密' },
    ],
  },
  {
    key: 'feishu',
    name: '飞书',
    desc: '飞书扫码登录，支持企业内部应用授权',
    fields: [
      { key: 'appId', label: 'App ID', hint: '飞书开放平台应用凭证', placeholder: 'cli_****' },
      { key: 'appSecret', label: 'App Secret', type: 'password', hint: '应用密钥，注意保密' },
    ],
  },
];

// 表单：结构与后端 system_settings / oauth_providers 的字段规划保持一致，
// 接入后端时把 load()/save() 换成真实接口即可，模板无需改动。
const form = reactive({
  brand: {
    name: brand.name,
    shortName: brand.shortName,
    description: brand.description,
    welcome: brand.welcome,
    footer: brand.footer,
    logo: brand.logo,
  },
  density: 'standard',
  radius: 'md',
  email: {
    enabled: false,
    host: '',
    port: '465',
    encryption: 'ssl',
    from: '',
    fromName: '',
    username: '',
    password: '',
  },
  oauth: {
    wecom: { enabled: false, corpId: '', agentId: '', secret: '', visibleRange: '' },
    dingtalk: { enabled: false, appKey: '', appSecret: '' },
    feishu: { enabled: false, appId: '', appSecret: '' },
  },
});

// 进入设置页时，把「服务端已持久化的品牌」同步进表单：
// form 在 setup 期拷贝的是当时的值，而服务端品牌是异步加载的，可能晚于 setup 完成。
const emailSaved = ref(false); // 服务端是否已存过 SMTP 密码
const emailLoading = ref(false);
const testing = ref(false);

onMounted(() => {
  Object.assign(form.brand, {
    name: brand.name,
    shortName: brand.shortName,
    description: brand.description,
    welcome: brand.welcome,
    footer: brand.footer,
    logo: brand.logo,
  });
  loadEmailFromServer();
});

// 邮件配置同样从服务端回填（密码不会下发，只回一个 hasPassword 标记）
async function loadEmailFromServer() {
  emailLoading.value = true;
  try {
    const s = await api('/api/admin/settings');
    const e = s?.email || {};
    Object.assign(form.email, {
      enabled: !!e.enabled,
      host: e.host || '',
      port: e.port ? String(e.port) : '465',
      encryption: e.encryption || 'ssl',
      from: e.from || '',
      fromName: e.fromName || '',
      username: e.username || '',
      password: '',
    });
    emailSaved.value = !!e.hasPassword;
  } catch {
    // 拉不到就保持默认空表单，不阻断页面（邮件 Tab 本来就可用）
  } finally {
    emailLoading.value = false;
  }
}

const openProvider = ref('');
const fileInput = ref(null);
const saving = ref(false);
const testTo = ref('');
const toast = ref(null);
let toastTimer = null;

/** 各 Tab 的常驻说明：把「已生效」和「UI 占位」讲清楚，避免误导 */
const NOTES = {
  brand: {
    tone: 'info',
    text: '基础信息已持久化到服务端（system_settings 表）：保存后侧栏、登录页与浏览器标题立即生效，换设备或换浏览器也一致。',
  },
  appearance: { tone: 'info', text: '外观设置即时生效，保存在浏览器本地，切换设备不跟随账号同步。' },
  email: {
    tone: 'info',
    text: '邮件服务已接入：保存后配置落库，SMTP 密码用 AES-256-GCM 加密存储，可点「发送测试邮件」验证连通性。业务侧发信直接调 lib/mailer.js 的 sendMail()。',
  },
  oauth: {
    tone: 'pending',
    text: '第三方登录目前为 UI 占位（未实现授权流程）。后端已具备 oauth_providers / user_identities 表结构，接入时补授权码流程即可。',
  },
};

const note = computed(() => NOTES[tab.value] || NOTES.brand);

const toneCls = {
  // info 走 brand 令牌（变量），暗色自动翻转；pending/error 用半透明底适配暗色
  info: 'border-brand-200 bg-brand-50 text-brand-700',
  pending:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  error:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
};

function flash(text, tone = 'info') {
  toast.value = { text, tone };
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 4500);
}

function callbackUrl(key) {
  const origin = typeof location !== 'undefined' ? location.origin : 'https://your-domain';
  return `${origin}/api/oauth/${key}/callback`;
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    flash('回调地址已复制到剪贴板');
  } catch {
    flash('当前浏览器不允许自动复制，请手动选择文本复制', 'error');
  }
}

async function onPickLogo(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    form.brand.logo = await readLogoFile(file);
  } catch (err) {
    flash(err.message, 'error');
  }
  e.target.value = '';
}

/** 把表单里的邮件配置整理成可提交/可试发的形态 */
function emailPayload() {
  const email = { ...form.email };
  // 密码留空 = 保持已保存的不动。带着空串上去会把库里的密码清掉。
  if (!email.password) delete email.password;
  return email;
}

async function onTestEmail() {
  if (!testTo.value.trim()) {
    flash('请先填写测试收件人', 'error');
    return;
  }
  testing.value = true;
  try {
    // 带上当前表单配置：改完还没保存也能先验证（密码留空则沿用库里已存的）
    const r = await api('/api/admin/settings/email/test', {
      method: 'POST',
      body: JSON.stringify({ to: testTo.value.trim(), config: emailPayload() }),
    });
    flash(`测试邮件已发送到 ${r.to}`);
  } catch (e) {
    flash(e.message || '发送失败', 'error');
  } finally {
    testing.value = false;
  }
}

async function onSave() {
  saving.value = true;
  try {
    // 品牌与邮件一起提交（同一行 system_settings，两次 PUT 会有中间态）；
    // 第三方登录仍是 UI 占位，不伪造保存成功。
    const email = emailPayload();
    await saveBrandToServer({ ...form.brand }, { email });
    emailSaved.value = emailSaved.value || !!email.password;
    form.email.password = '';
    flash(
      email.password
        ? '已保存：品牌即时生效，邮件配置与 SMTP 密码已加密落库。'
        : '已保存：品牌即时生效，邮件配置已落库（密码沿用已保存的）。'
    );
  } catch (e) {
    flash(e.message || '保存失败', 'error');
  } finally {
    saving.value = false;
  }
}

function onReset() {
  Object.assign(form.brand, {
    name: DEFAULT_BRAND.name,
    shortName: DEFAULT_BRAND.shortName,
    description: DEFAULT_BRAND.description,
    welcome: DEFAULT_BRAND.welcome,
    footer: DEFAULT_BRAND.footer,
    logo: DEFAULT_BRAND.logo,
  });
  form.density = 'standard';
  form.radius = 'md';
  Object.assign(form.email, {
    enabled: false,
    host: '',
    port: '465',
    encryption: 'ssl',
    from: '',
    fromName: '',
    username: '',
    password: '',
  });
  Object.assign(form.oauth.wecom, { enabled: false, corpId: '', agentId: '', secret: '', visibleRange: '' });
  Object.assign(form.oauth.dingtalk, { enabled: false, appKey: '', appSecret: '' });
  Object.assign(form.oauth.feishu, { enabled: false, appId: '', appSecret: '' });
  openProvider.value = '';
  flash('已恢复默认值（尚未保存）');
}
</script>
