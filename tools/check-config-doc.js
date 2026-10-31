/* 对账：assets/vars.js 的配置清单 ↔ config/pet.yaml ↔ docs/CONFIG.md */
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function loadYaml() {
    const cands = ['js-yaml', path.join(ROOT, 'node_modules', 'js-yaml'),
        path.join(ROOT, 'vendor', 'js-yaml.min.js'),
        path.join(ROOT, '..', 'Blogs', 'node_modules', 'js-yaml')];
    for (const c of cands) {
        try { return require(c); } catch (e) { /* next */ }
    }
    return null;
}

const yaml = loadYaml();
if (!yaml) { console.error('js-yaml 不可用'); process.exit(1); }

/* ---- 清单（唯一来源） ---- */
const ctx = { window: {} };
ctx.window.window = ctx.window;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets', 'vars.js'), 'utf8'), ctx);
const KEYS = ctx.window.PetVars.config.map((f) => f.k);

/* ---- 真实配置的全部叶子路径 ---- */
const cfg = yaml.load(fs.readFileSync(path.join(ROOT, 'config', 'pet.yaml'), 'utf8'));

function walk(obj, prefix, out) {
    for (const k of Object.keys(obj)) {
        const p = prefix ? prefix + '.' + k : k;
        const v = obj[k];
        if (v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length) walk(v, p, out);
        else out.push(p);
    }
    return out;
}
const ALL = walk(cfg, '', []);

/* 通配：'states.*' 与 'states.*.loop'
 *   前缀段必须匹配；有尾段时，尾段要出现在路径里（loop 出现在 states.*.loop.intro 中间）。
 *   只要该前缀下确实有叶子就算覆盖。 */
function matches(pattern, p) {
    if (pattern.indexOf('*') < 0) return p === pattern || p.indexOf(pattern + '.') === 0;
    const segs = pattern.split('*');
    const head = segs[0];
    const tail = segs[1] || '';
    if (p.indexOf(head) !== 0) return false;
    if (tail && p.indexOf(tail) < 0) return false;
    return p.length > head.length;
}

/* ---- 文档里出现的键 ---- */
const doc = fs.readFileSync(path.join(ROOT, 'docs', 'CONFIG.md'), 'utf8');
const DOC = [];
for (const line of doc.split('\n')) {
    const m = line.match(/^\| `([^`]+)` \|/);
    if (m) DOC.push(m[1]);
}

const problems = [];
/* persona.en 是可选的覆盖层：没写就是「全用中文」，不算缺失 */
const OPTIONAL = ['persona.en'];

for (const key of KEYS) {
    if (OPTIONAL.indexOf(key) >= 0) continue;
    if (!ALL.some((p) => matches(key, p))) problems.push('清单有、配置里没有：' + key);
}
for (const p of ALL) {
    if (!KEYS.some((key) => matches(key, p))) problems.push('配置里有、清单没写：' + p);
}
for (const key of KEYS) if (DOC.indexOf(key) < 0) problems.push('清单有、文档没写：' + key);
for (const key of DOC) if (KEYS.indexOf(key) < 0) problems.push('文档有、清单没有：' + key);

console.log('清单条目: ' + KEYS.length + ' | 配置叶子: ' + ALL.length + ' | 文档行: ' + DOC.length);

if (problems.length) {
    console.log('');
    problems.forEach((p) => console.log('  ✗ ' + p));
    process.exit(1);
}
console.log('✓ 配置清单、配置文件与文档三者一致');
