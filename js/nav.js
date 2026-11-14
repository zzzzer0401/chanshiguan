// 场景路由（避免场景之间循环引用）
const nav = {
  app: null,
  factories: {},
  go(name, a, b) { this.app.go(this.factories[name](a, b)); },
};
export default nav;
