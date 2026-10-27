/*!
 * states-data.test.js —— 状态词汇表与策略数据的一致性
 *
 * 宠物侧只提供词汇（states），站点侧提供判断（policy）。
 * 这里守住三条：词汇完整、片段存在、策略只引用已声明的状态。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PetConfig from "../../js/pet/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

let pass = 0, fail = 0;
const ok = (c, n, extra) => c ? (pass++, console.log("  ok", n)) : (fail++, console.log("  FAIL", n, extra === undefined ? "" : extra));

const states = PetConfig.states || {};
const policy = PetConfig.policy || {};
const rules = policy.stateRules || [];
const calendar = policy.calendar || {};

ok(Object.keys(states).length >= 1, "至少声明一个状态");
ok(!!states.idle, "必须有 idle 作为兜底");

const clips = new Set(
    fs.readdirSync(path.join(ROOT, "images/pet/anim"))
        .filter((f) => f.endsWith(".webm"))
        .map((f) => f.replace(/\.webm$/, ""))
);

Object.keys(states).forEach((id) => {
    const s = states[id] || {};
    ok(!!s.clip, `${id}: 有 clip`);
    ok(clips.has(s.clip), `${id}: clip 片段存在`, s.clip);
    const pool = s.pool || [];
    ok(pool.length > 0, `${id}: pool 非空`);
    const missing = pool.filter((c) => !clips.has(c));
    ok(missing.length === 0, `${id}: pool 里的片段都存在`, missing.join(","));
    if (s.weight != null) {
        ok(typeof s.weight === "number" && Number.isFinite(s.weight) && s.weight >= 0,
            `${id}: weight 是非负数字`, String(s.weight));
    }
});

ok(rules.length > 0, "站点侧至少有一条状态策略");
const declared = new Set(Object.keys(states));
const unknown = rules.map((r) => r.state).filter((s) => !declared.has(s));
ok(unknown.length === 0, "策略不引用未声明的状态", unknown.join(","));
ok(rules.every((r) => r.when && typeof r.when === "object"), "每条策略都有 when");

const days = Object.keys(calendar);
ok(days.length > 0, "日历非空");
const badDay = days.filter((d) => !/^\d{1,2}-\d{1,2}$/.test(d));
ok(badDay.length === 0, "日历键都是 M-D 格式", badDay.join(","));
const badAct = days.filter((d) => !clips.has(calendar[d].act));
ok(badAct.length === 0, "日历里的片段都存在", badAct.join(","));
ok(days.every((d) => typeof calendar[d].line === "string" && calendar[d].line.length > 0), "每个日历条目都有台词");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
