// server/resource-types.setup.js
// 业务接入点：在这里注册你项目自己的资源类型。
//
// 脚手架默认带两个示例（服务 / 数据集），只为让首页开箱有内容可看，
// 接业务时直接替换或删除即可 —— 注册后会自动出现在：
//   · 前端首页资源网格（/api/resource-types）
//   · 后台「资源组」白名单勾选（/api/resources）
//
// 真实项目通常从数据库取，例如：
//   registerResourceType({
//     key: 'model', name: '模型', sortOrder: 1,
//     listAll: async () => (await global.db.query('SELECT id FROM models')).rows.map((r) => String(r.id)),
//     isVisibleToUser: async (userId, ids) => ids, // 可选：二次过滤
//   });

const { registerResourceType } = require('./lib/resource-types');

registerResourceType({
  key: 'service',
  name: '服务',
  sortOrder: 1,
  listAll: async () => ['gateway', 'scheduler'],
});

registerResourceType({
  key: 'dataset',
  name: '数据集',
  sortOrder: 2,
  listAll: async () => ['public', 'internal'],
});
