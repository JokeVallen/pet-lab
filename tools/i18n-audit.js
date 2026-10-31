/*!
 * tools/i18n-audit.js —— 可视化页面的文案体检
 *
 *   node tools/i18n-audit.js          列出各页面用到、但字典里没有的 key
 *
 * 只做检查，不改文件。发行前跑一次，避免"切英文还是中文"的老问题。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAGES = [
    'index.html', 'demo.html', 'config-editor.html', 'copy-editor.html', 'vars.html', 'rules-editor.html',
    'zone-editor.html', 'docs.html', 'tests.html', 'pets.html'
];

function keysOf(file) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    return new Set([
        ...[...src.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]),
        ...[...src.matchAll(/data-i18n-placeholder="([^"]+)"/g)].map((m) => m[1]),
        ...[...src.matchAll(/data-title-key="([^"]+)"/g)].map((m) => m[1])
    ]);
}

const i18n = fs.readFileSync(path.join(ROOT, 'assets', 'i18n.js'), 'utf8');
const defined = new Set([
    ...[...i18n.matchAll(/^\s{4,8}'([A-Za-z0-9_.]+)':\s*\[/gm)].map((m) => m[1])
]);

let bad = 0;
for (const page of PAGES) {
    if (!fs.existsSync(path.join(ROOT, page))) continue;
    const used = keysOf(page);
    const miss = [...used].filter((k) => !defined.has(k));
    if (miss.length) {
        bad += miss.length;
        console.log(page.padEnd(22) + '缺 ' + String(miss.length).padStart(2) + ' 个: ' + miss.join(', '));
    } else {
        console.log(page.padEnd(22) + '✓ ' + used.size + ' 个 key 齐全');
    }
}

console.log('\n字典条目: ' + defined.size);
if (bad) {
    console.log('✗ 还有 ' + bad + ' 个 key 未定义');
    process.exit(1);
}
console.log('✓ 全部页面文案齐全');
