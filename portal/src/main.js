import { createApp } from 'vue';
import router from './router';
import './style.css';
import App from './App.vue';
import { initTheme } from './composables/useTheme';
import { initBrand } from './composables/useBrand';

// 主题与品牌必须在 mount 之前落地，否则首屏会先闪一下默认外观再跳变。
// 补充：index.html 里还有一段内联脚本，在 CSS 加载前先把 html.dark 打上，
// 消除暗色模式的首屏白闪（此处的 initTheme 负责后续状态同步）。
initTheme();
initBrand();

createApp(App).use(router).mount('#app');
