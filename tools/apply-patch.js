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

if (!applied.length) { console.error('patch has nothing to apply'); process.exit(1); }

fs.writeFileSync(SRC, yaml.dump(cfg, { lineWidth: 120, noRefs: true }), 'utf8');
console.log('patched: ' + applied.join(', '));
