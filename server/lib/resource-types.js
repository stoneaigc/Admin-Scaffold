// server/lib/resource-types.js
// 资源类型注册表。脚手架业务无关：每个项目在此注册自己的资源类型（模型/Skill/文档/...），
// 权限引擎据此做"资源组白名单"可见性判断，前端据此渲染广场。
//
// 适配器接口（按需实现）：
//   key:           字符串，唯一，如 'model' / 'skill' / 'doc'
//   name:          展示名
//   sortOrder:     排序
//   listAll():     返回该类型全量资源 id 数组（后台配置资源组时勾选用）
//   isVisibleToUser(userId, ids): 可选，对勾选出的 id 做二次过滤，返回可见 id 数组
//
// 示例（在你的项目里调用 registerResourceType）：
//   registerResourceType({
//     key: 'model', name: '模型', sortOrder: 1,
//     listAll: async () => (await global.db.query('SELECT id FROM models')).rows.map(r => String(r.id)),
//   });

const registry = new Map();

function registerResourceType(def) {
  if (!def || !def.key) throw new Error('registerResourceType 需要 key');
  registry.set(def.key, def);
}

function unregisterResourceType(key) {
  registry.delete(key);
}

function getResourceType(key) {
  return registry.get(key) || null;
}

function getAllResourceTypes() {
  return Array.from(registry.values()).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

module.exports = { registerResourceType, unregisterResourceType, getResourceType, getAllResourceTypes };
