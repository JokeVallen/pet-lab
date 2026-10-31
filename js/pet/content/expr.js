/*!
 * content/expr.js —— 文案表达式
 *
 * 这是占位符语法的**唯一实现**：运行时（content/index.js）与编辑器预览
 * 都从这里取同一个 fill，行为不会两处漂移。
 *
 * 语法：
 *   {pet}                          取值
 *   {title?'读《{title}》':'随便'}   有值用前段，没有用后段
 *   {tag??'没标签'}                空值才用后备
 *   {!title?a:b}                   条件取反
 *
 * 未知变量原样保留，写错名字看得见。
 */

const MAX_DEPTH = 8;

function has(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

/* 空串、0、"0"、false、null、undefined 都当"没有" */
function truthy(v) {
    if (v === undefined || v === null || v === false) return false;
    if (v === 0 || v === '0') return false;
    if (typeof v === 'string' && v.trim() === '') return false;
    return true;
}

/* 从 '{' 找配对的 '}'，跳过引号里的内容与嵌套花括号 */
function findClose(src, start) {
    let depth = 0;
    let quote = null;
    for (let i = start; i < src.length; i += 1) {
        const c = src[i];
        if (quote) {
            if (c === '\\') { i += 1; continue; }
            if (c === quote) quote = null;
            continue;
        }
        if (c === '\'' || c === '"') { quote = c; continue; }
        if (c === '{') depth += 1;
        else if (c === '}') {
            depth -= 1;
            if (depth === 0) return i;
        }
    }
    return -1;
}

/* 在顶层找某个字符（跳过引号与嵌套） */
function findTop(src, ch) {
    let depth = 0;
    let quote = null;
    for (let i = 0; i < src.length; i += 1) {
        const c = src[i];
        if (quote) {
            if (c === '\\') { i += 1; continue; }
            if (c === quote) quote = null;
            continue;
        }
        if (c === '\'' || c === '"') { quote = c; continue; }
        if (c === '{') { depth += 1; continue; }
        if (c === '}') { depth -= 1; continue; }
        if (depth === 0 && c === ch) return i;
    }
    return -1;
}

/* 整段被引号包住就剥掉，顺便还原转义 */
function unquote(src) {
    const s = src.trim();
    if (s.length < 2) return null;
    const q = s[0];
    if ((q !== '\'' && q !== '"') || s[s.length - 1] !== q) return null;
    const body = s.slice(1, -1);
    return body.replace(/\\(.)/g, '$1');
}

function render(src, vars, depth) {
    if (depth > MAX_DEPTH) return src;
    let out = '';
    let i = 0;
    while (i < src.length) {
        const ch = src[i];
        if (ch !== '{') { out += ch; i += 1; continue; }
        const close = findClose(src, i);
        if (close < 0) { out += src.slice(i); break; }
        const got = evaluate(src.slice(i + 1, close), vars, depth);
        out += (got === undefined) ? src.slice(i, close + 1) : got;
        i = close + 1;
    }
    return out;
}

/* 分支是"文本模板"，不是表达式：里面的 {pet} 照常替换，普通文字原样出来 */
function branch(text, vars, depth) {
    const s = String(text == null ? '' : text);
    const lit = unquote(s);
    return render(lit === null ? s : lit, vars, depth + 1);
}

function evaluate(inner, vars, depth) {
    const expr = inner.trim();
    if (!expr) return undefined;

    /* 整段是引号字符串：当普通文本再渲染一层 */
    const lit = unquote(expr);
    if (lit !== null) return render(lit, vars, depth + 1);

    /* 问号：先看是不是 ?? */
    const qi = findTop(expr, '?');
    if (qi >= 0) {
        const condRaw = expr.slice(0, qi).trim();
        const isNullish = expr[qi + 1] === '?';
        const negated = condRaw.charAt(0) === '!';
        const condKey = (negated ? condRaw.slice(1) : condRaw).trim();

        if (/^\w+$/.test(condKey)) {
            const ok = truthy(vars[condKey]);

            if (isNullish) {
                if (ok) return render(String(vars[condKey]), vars, depth + 1);
                return branch(expr.slice(qi + 2), vars, depth);
            }

            const rest = expr.slice(qi + 1);
            const ci = findTop(rest, ':');
            const a = ci >= 0 ? rest.slice(0, ci) : rest;
            const b = ci >= 0 ? rest.slice(ci + 1) : '';
            const take = negated ? !ok : ok;
            return branch(take ? a : b, vars, depth);
        }
    }

    /* 普通取值 */
    if (!/^\w+$/.test(expr)) return undefined;
    if (!has(vars, expr)) return undefined;
    return render(String(vars[expr]), vars, depth + 1);
}

/**
 * 造一个 fill(text, vars)：getVars() 每次调用时现取全局变量，
 * 局部变量优先于全局。
 */
export function makeFill(getVars) {
    return function fill(text, vars) {
        const src = String(text == null ? '' : text);
        if (src.indexOf('{') < 0) return src;
        let base = {};
        try { base = (getVars && getVars()) || {}; } catch (e) { base = {}; }
        const merged = Object.assign({}, base, vars || {});
        return render(src, merged, 0);
    };
}

export const exprInternals = { truthy, findClose, findTop, unquote };
