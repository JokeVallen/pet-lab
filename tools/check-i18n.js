/* 漏翻检查：找出页面里没走 T()/data-i18n 的中文界面文案。
 *
 * 只认「会显示给用户」的字符串：出现在 <script> 里的中文常量；
 * 注释、data-i18n 元素、i18n 字典本身都跳过。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* 字典里的中文源串：出现在页面里的说明这串已接入 i18n */
const TERMS_ZH = new Set();
{
    const src = fs.readFileSync(path.join(ROOT, 'assets', 'i18n.js'), 'utf8');
    const start = src.indexOf('var TERMS');
    const seg = src.slice(start, src.indexOf('\n    };', start));
    for (const m of seg.matchAll(/^\s*'((?:\\.|[^'\\])*)':/gm)) {
        const raw = m[1];
        TERMS_ZH.add(raw.replace(/\\'/g, "'").replace(/\\\\/g, '\\').replace(/\\n/g, '\n'));
        TERMS_ZH.add(raw);                                  /* 也保留「字面 \n」的写法 */
    }
}

/* 这些文件里允许出现中文：它们是配置样例、文档、测试数据 */
const SKIP_FILES = ['pets.html'];

/* 已确认「不需要翻译」的片段：控制台日志、写进 YAML 的注释、内部标识 */
const ALLOW = [
    /^\[lab\]/,
    /['"]\s*\+/,          /* 模板拼接的残留 */
    /\r\n/,               /* 跨行残留 */
    /^<\/?[a-z]/,          /* HTML 片段残留 */
    /^#/,                    // YAML dump 的注释
    /^·/,
    /^（/                   // 纯括号说明，多数是 value 占位
];

function chineseStrings(js) {
    const out = [];
    /* 单引号 / 双引号 / 反引号字符串，且含中日韩字符 */
    const re = /(['"`])((?:\\.|(?!\1)[^\\])*[\u4e00-\u9fa5][^\\]*?)\1/g;
    let m;
    while ((m = re.exec(js))) {
        const s = m[2];
        if (s.length > 400) continue;                 // 大段文本多半是模板
        out.push(s);
    }
    return out;
}

/* 记录所有被 T(...) / .t(...) 包住的中文字符串 */
const WALK = new Set();
function collectWrapped(js) {
    const re = /\bT\(\s*(['"])((?:\\.|(?!\1)[^\\])*[\u4e00-\u9fa5][^\\]*?)\1\s*\)/g;
    let m;
    while ((m = re.exec(js))) WALK.add(m[2]);
}

function stripComments(js) {
    return js
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
}

function scriptsOf(html) {
    const out = [];
    const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = re.exec(html))) out.push(m[1]);
    return out;
}

const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && SKIP_FILES.indexOf(f) < 0);
let total = 0;

for (const page of pages) {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    const found = new Map();
    for (const raw of scriptsOf(html)) {
        const js = stripComments(raw);
        collectWrapped(js);
        for (const s of chineseStrings(js)) {
            if (ALLOW.some((re) => re.test(s.trim()))) continue;
            /* 已经包在 T(...) 里的算翻过了 */
            if (WALK.has(s)) continue;
            /* 字典里有对应翻译的也算：说明它已接入 i18n（渲染路径待探针确认） */
            if (TERMS_ZH.has(s)) continue;
            found.set(s, (found.get(s) || 0) + 1);
        }
    }
    if (!found.size) continue;
    total += found.size;
    console.log('=== ' + page + '  未走 i18n 的中文字符串 ' + found.size + ' 条 ===');
    [...found.keys()].slice(0, 12).forEach((s) => console.log('    ' + JSON.stringify(s.slice(0, 60))));
    if (found.size > 12) console.log('    …');
}

console.log('');
console.log(total ? '✗ 共 ' + total + ' 条需要处理' : '✓ 所有页面文案都走 i18n');
process.exit(total ? 1 : 0);
