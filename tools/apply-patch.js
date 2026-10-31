/*!
 * apply-patch.js —— 把结构化补丁合并进 config/pet.yaml
 *
 * 用法：node tools/apply-patch.js <patch.json>
 * 补丁形如：{ "zones": [...], "zoneReactions": {...}, "rulesItems": [...] }
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'config', 'pet.yaml');

function loadYaml() {
    const candidates = [
        'js-yaml',
        path.join(ROOT, 'node_modules', 'js-yaml'),
        path.join(ROOT, '..', 'Blogs', 'node_modules', 'js-yaml')
    ];
    for (const c of candidates) {
        try { return require(c); } catch (e) { /* next */ }
    }
    console.error('js-yaml not found');
    process.exit(1);
}

const yaml = loadYaml();
const patchPath = process.argv[2];
if (!patchPath) { console.error('usage: node tools/apply-patch.js <patch.json>'); process.exit(1); }

const patch = JSON.parse(fs.readFileSync(patchPath, 'utf8'));
const cfg = yaml.load(fs.readFileSync(SRC, 'utf8'));

const applied = [];
if (Array.isArray(patch.zones)) { cfg.zones = patch.zones; applied.push('zones'); }
if (patch.zoneReactions && typeof patch.zoneReactions === 'object') {
    cfg.zoneReactions = patch.zoneReactions;
    applied.push('zoneReactions');
}
if (Array.isArray(patch.rulesItems)) {
    cfg.rules = cfg.rules || {};
    cfg.rules.items = patch.rulesItems;
    applied.push('rules.items');
}
if (Array.isArray(patch.stateRules)) {
    // 条件 → 状态，归规则页面管；配置页只负责 states 定义本身
    cfg.policy = cfg.policy || {};
    cfg.policy.stateRules = patch.stateRules;
    applied.push('policy.stateRules');
}

/* 文案：补齐或更新 persona 下的若干键。
 * 只动补丁里出现的键，其余（name / icons / 别的语言的覆盖）原样保留；
 * 值写 null 表示删掉这条覆盖，回落到内容包的默认文案。 */
if (patch.personaCopy && typeof patch.personaCopy === 'object') {
    cfg.persona = cfg.persona || {};
    let touched = 0;
    for (const [key, value] of Object.entries(patch.personaCopy)) {
        const path = key.split('.');            // 支持 en.about 这种两级键
        let node = cfg.persona;
        for (let i = 0; i < path.length - 1; i += 1) {
            node[path[i]] = node[path[i]] || {};
            node = node[path[i]];
        }
        const leaf = path[path.length - 1];
        if (value === null || value === undefined) {
            delete node[leaf];
        } else {
            node[leaf] = value;
        }
        touched += 1;
    }
    /* 删空的子对象：全删光之后别留 persona.en: {} 这种空壳 */
    for (const k of Object.keys(cfg.persona)) {
        const v = cfg.persona[k];
        if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) {
            delete cfg.persona[k];
        }
    }
    applied.push('persona(' + touched + ')');
}

if (!applied.length) { console.error('patch has nothing to apply'); process.exit(1); }

fs.writeFileSync(SRC, yaml.dump(cfg, { lineWidth: 120, noRefs: true }), 'utf8');
console.log('patched: ' + applied.join(', '));
