const fs = require('fs');
const path = require('path');
const yaml = require('D:/Users/User/Blogs/node_modules/js-yaml');

const ROOT = 'D:/Users/User/pet-lab';
const SRC = path.join(ROOT, 'config', 'pet.yaml');
const BAK = path.join(ROOT, 'config', '.tmp-test-backup.yaml');

const original = fs.readFileSync(SRC, 'utf8');
fs.writeFileSync(BAK, original, 'utf8');
const cfg = yaml.load(original);

const payload = {
    rulesItems: cfg.rules.items,
    stateRules: cfg.policy.stateRules
};

(async () => {
    const res = await fetch('http://127.0.0.1:8232/api/patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch: payload })
    });
    const data = await res.json();
    console.log('HTTP', res.status, '| ok:', data.ok, '| patch:', data.patch || data.error);
    console.log('build stderr:', (data.stderr || '').slice(0, 120) || '(无)');

    const after = yaml.load(fs.readFileSync(SRC, 'utf8'));
    console.log('stateRules 条数:', (after.policy.stateRules || []).length, '(原', payload.stateRules.length, ')');
    console.log('rules.items 条数:', (after.rules.items || []).length, '(原', payload.rulesItems.length, ')');
    console.log('policy 其它键:', Object.keys(after.policy).join(','));
    console.log('calendar 条数:', Object.keys(after.policy.calendar || {}).length);

    // 还原
    fs.writeFileSync(SRC, original, 'utf8');
    console.log('已还原 pet.yaml');
})();
