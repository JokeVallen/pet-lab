import { PetRules as R } from "../../js/pet/modules/rules.js";
import PetConfig from "../../js/pet/config.js";

let pass = 0, fail = 0;
const ok = (c, n) => { c ? (pass++, console.log("  ok", n)) : (fail++, console.log("  FAIL", n)); };

const w = R.compileWhen({ page: "post", tagsAny: ["unity"] });
ok(w({ page: "post", tags: ["Unity"] }, {}) === true, "tagsAny 命中（大小写不敏感）");
ok(w({ page: "post", tags: ["算法"] }, {}) === false, "标签不匹配时拒绝");
ok(w({ page: "home", tags: ["unity"] }, {}) === false, "页面不匹配时拒绝");

const w2 = R.compileWhen({ scrollGt: 0.85 });
ok(w2({ scroll: 0.9 }, {}) === true, "scrollGt 成立");
ok(w2({ scroll: 0.5 }, {}) === false, "scrollGt 不成立");

const w3 = R.compileWhen({ lastScrollGt: 0.8, scrollLt: 0.25 });
ok(w3({ scroll: 0.1 }, { lastScroll: 0.9 }) === true, "回顶组合条件");
ok(w3({ scroll: 0.1 }, { lastScroll: 0.2 }) === false, "lastScroll 不满足");

ok(R.renderSay("第 {streak} 天", null, { streak: 4 }) === "第 4 天", "模板插值 streak");
ok(R.renderSay(["a"], null, {}) === "a", "数组取一条");

const items = (PetConfig.rules && PetConfig.rules.items) || [];
ok(items.length === 12, "配置里有 12 条规则", items.length);
ok(items.every((r) => r.id && r.when && r.say), "每条规则都有 id/when/say");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
