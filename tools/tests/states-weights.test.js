/*!
 * states-weights.test.js —— pickState 的加权兜底
 *
 * 规则命中时按规则走；没有规则命中时，按 states.<id>.weight 加权。
 * 全都没写 weight（老配置）时必须退回 idle，行为不能变。
 */
import PetConfig from "../../js/pet/config.js";

/* adapter 只在调用时触 DOM，这里给最小桩 */
globalThis.location = { pathname: "/", href: "http://x/" };
globalThis.document = {
    querySelector: () => null,
    querySelectorAll: () => [],
    documentElement: { scrollHeight: 1000, classList: { contains: () => false } },
    body: { classList: { contains: () => false } }
};
globalThis.window = { innerHeight: 800, innerWidth: 1200 };

const { PetAdapter } = await import("../../js/pet/adapter.js");

let pass = 0, fail = 0;
const ok = (c, n, extra) => c ? (pass++, console.log("  ok", n)) : (fail++, console.log("  FAIL", n, extra === undefined ? "" : extra));

const original = PetConfig.states;

function sample(n) {
    const out = {};
    for (let i = 0; i < n; i++) {
        const s = PetAdapter.pickState({});
        out[s] = (out[s] || 0) + 1;
    }
    return out;
}

/* 1) 老配置：没有 weight，永远 idle */
PetConfig.states = { idle: { clip: "idle", pool: ["idle"] }, sleepy: { clip: "sleep", pool: ["sleep"] } };
ok(PetAdapter.pickState({}) === "idle", "没有权重时退回 idle");
const plain = sample(200);
ok(Object.keys(plain).length === 1 && plain.idle === 200, "200 次全是 idle", JSON.stringify(plain));

/* 2) 有权重时按权重抽 */
PetConfig.states = {
    idle: { clip: "idle", pool: ["idle"], weight: 90 },
    sleepy: { clip: "sleep", pool: ["sleep"], weight: 10 }
};
const mixed = sample(2000);
ok(!!mixed.sleepy, "权重状态会被抽到", JSON.stringify(mixed));
ok(mixed.sleepy > 60 && mixed.sleepy < 340, "sleepy 占比约 10%", JSON.stringify(mixed));

/* 3) 权重 0 的状态不会被抽到 */
PetConfig.states = {
    idle: { clip: "idle", pool: ["idle"], weight: 1 },
    busy: { clip: "code", pool: ["code"], weight: 0 }
};
const zero = sample(400);
ok(!zero.busy, "权重 0 不参与抽取", JSON.stringify(zero));

/* 4) 规则命中优先于权重 */
PetConfig.states = { idle: { weight: 1 }, sleepy: { weight: 1000 } };
PetConfig.policy = Object.assign({}, PetConfig.policy, { stateRules: [{ when: { hourBelow: 6 }, state: "busy" }] });
ok(PetAdapter.pickState({ hour: 3 }) === "busy", "规则命中时优先用规则");
delete PetConfig.policy.stateRules;

PetConfig.states = original;

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
