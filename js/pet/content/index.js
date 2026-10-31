/*!
 * content/index.js —— 文案层
 *
 * 代码只认 key，不认句子；所有给访客看的字都来自 content/<lang>.js。
 *   PetContent.t('mood.happy')                → 当前语言的一句话
 *   PetContent.t('site.streak', { n: 3 })      → 模板替换
 *   PetContent.pick('chat.fallback')           → 数组里随机取一条
 *   PetContent.list('bond.zone.head')          → 取整个数组
 *   PetContent.replies()                       → [{ id, re, lines }]，正则在取用时编译
 *   PetContent.setLang('en')                   → 切换语言（已渲染的文字不会追溯）
 *
 * 语言判定：站点里的用户状态（userState）记住的选择 → <html lang> → 默认中文。
 * 没有站点（演示页）时才退回 localStorage，保持本地调试可用。
 * 缺 key 时回落到中文，再缺就返回 key 本身（方便发现漏翻）。
 */
import zh from './zh.js';
import en from './en.js';
import { PetSite } from '../site.js';
import { makeFill } from './expr.js';

const PACKS = { zh: zh, en: en };
const FALLBACK = 'zh';
const STORE_KEY = 'pet-content-lang';

let current = FALLBACK;

/* 语言偏好属于"访客本机状态"：有站点就存进 userState，没有才用 localStorage */
function readSaved() {
    if (PetSite.available()) return PetSite.get('pet.lang', null);
    try {
        return localStorage.getItem(STORE_KEY);
    } catch (e) {
        return null;
    }
}

function writeSaved(code) {
    if (PetSite.available()) {
        PetSite.set('pet.lang', code);
        return;
    }
    writeSaved(code);
}

function detect() {
    const saved = readSaved();
    if (saved && PACKS[saved]) return saved;
    try {
        const lang = (document.documentElement.lang || '').toLowerCase();
        if (lang && lang.indexOf('zh') !== 0) return PACKS[lang.slice(0, 2)] ? lang.slice(0, 2) : 'en';
    } catch (e) { /* 无 DOM */ }
    return FALLBACK;
}

current = detect();

function walk(pack, path) {
    const parts = String(path).split('.');
    let cur = pack;
    for (let i = 0; i < parts.length; i++) {
        if (cur == null) return undefined;
        cur = cur[parts[i]];
    }
    return cur;
}

/* 全局占位符：由宿主注册（宠物名这类"改一处、全站生效"的值）。
 * 任何文案——内容包里的、配置 persona 里的——都能直接写 {name}，
 * 不用每个调用点各自传一遍，也不会因为某处漏传而定格成旧名字。 */
let GLOBAL_VARS = {};
let VAR_PROVIDER = null;

function setVars(vars) {
    GLOBAL_VARS = (vars && typeof vars === 'object') ? vars : {};
}

/* 提供者：每次替换时现取，语言、名字改了立刻生效，不用重新注册 */
function setVarProvider(fn) {
    VAR_PROVIDER = (typeof fn === 'function') ? fn : null;
}

function currentVars() {
    if (!VAR_PROVIDER) return GLOBAL_VARS;
    try {
        return Object.assign({}, VAR_PROVIDER() || {}, GLOBAL_VARS);
    } catch (e) {
        return GLOBAL_VARS;
    }
}

/* 表达式实现在 expr.js：运行时与编辑器预览共用同一份 */
const fill = makeFill(currentVars);

function raw(path) {
    const hit = walk(PACKS[current], path);
    if (hit !== undefined) return hit;
    return walk(PACKS[FALLBACK], path);
}

function t(path, vars) {
    const v = raw(path);
    if (v === undefined || v === null) return path;
    if (typeof v !== 'string') return fill(String(v), vars);
    return fill(v, vars);
}

function list(path) {
    const v = raw(path);
    if (Array.isArray(v)) return v.slice();
    if (typeof v === 'string') return [v];
    return [];
}

function pick(path, vars) {
    const arr = list(path);
    if (!arr.length) return t(path, vars);
    const one = arr[Math.floor(Math.random() * arr.length)];
    return typeof one === 'string' ? fill(one, vars) : one;
}

/* 聊天句库：正则只编译一次，语言切换时清掉缓存 */
let replyCache = null;
function replies() {
    if (replyCache) return replyCache;
    const src = raw('chat.replies') || [];
    replyCache = src.map(function (r) {
        let re = null;
        try { re = new RegExp(r.match, r.flags || ''); } catch (e) { re = null; }
        return { id: r.id, re: re, lines: r.lines || [] };
    }).filter(function (r) { return r.re; });
    return replyCache;
}

function setLang(code) {
    if (!PACKS[code]) return false;
    current = code;
    replyCache = null;
    try { localStorage.setItem(STORE_KEY, code); } catch (e) { /* ignore */ }
    return true;
}

export const PetContent = {
    get lang() { return current; },
    get vars() { return Object.assign({}, currentVars()); },
    setVars: setVars,
    setVarProvider: setVarProvider,
    fill: fill,
    get locales() { return Object.keys(PACKS).map(function (k) { return { code: k, label: PACKS[k].meta.label }; }); },
    t: t,
    pick: pick,
    list: list,
    replies: replies,
    setLang: setLang,
    keys: function () { return Object.keys(PACKS); }
};
