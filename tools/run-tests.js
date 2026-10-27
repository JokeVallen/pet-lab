/*!
 * run-tests.js —— 一次跑完所有测试
 *
 *   node tools/run-tests.js          单元测试（内核 / 规则 / 分区）
 *   node tools/run-tests.js --all    单元测试 + 端到端冒烟 + 中英一致性
 */
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const units = [
    'tools/tests/kernel.test.js',
    'tools/tests/rules.test.js',
    'tools/tests/rules-data.test.js',
    'tools/tests/levels.test.js',
    'tools/tests/states-data.test.js',
    'tools/tests/states-weights.test.js',
    'tools/tests/zones.test.js'
];

let failed = 0;

function run(file, label) {
    process.stdout.write(`\n== ${label} ==\n`);
    const r = spawnSync(process.execPath, [path.join(ROOT, file)], { stdio: 'inherit' });
    if (r.status !== 0) failed++;
}

units.forEach((f) => run(f, path.basename(f)));

if (process.argv.includes('--all')) {
    run('tools/smoke.js', 'smoke (e2e)');
    run('tools/i18n-check.js', 'i18n (zh/en)');
}

console.log(`\n${failed === 0 ? '全部通过' : failed + ' 个测试文件失败'}`);
process.exit(failed ? 1 : 0);
