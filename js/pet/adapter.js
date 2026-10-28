/*!
 * adapter.js —— 站点适配层（只认 window.SiteAPI）
 *
 * 这一层是宠物唯一"知道站点"的地方，但它只知道 SiteAPI：
 * 不查 DOM、不读 location、不直接写 localStorage。
 * 换站点只要那边实现了 SiteAPI，这边一行不用改。
 *
 * 站点没给的东西（主题、评论数）就当作不知道——
 * 对应的规则自然不命中，而不是回头去爬页面。
 */
import PetConfig from './config.js';
import { PetRules } from './modules/rules.js';
import { PetContent } from './content/index.js';
import { PetSite } from './site.js';

const C = PetContent;

/* ---------------- 配置里的规则 ---------------- */

function buildRules() {
    var items = (PetConfig && PetConfig.rules && PetConfig.rules.items) || [];
    return items.map(function (r) {
        var acts = Array.isArray(r.act) ? r.act : (r.act == null ? [] : [r.act]);
        return {
            id: r.id,
            when: PetRules.compileWhen(r.when),
            say: function (ctx, env) {
                var e = Object.assign({}, env || {}, {
                    tagName: (env && env.adapter && env.adapter.tagName) ? env.adapter.tagName() : ''
                });
                return PetRules.renderSay(r.say, ctx, e);
            },
            act: function () {
                if (!acts.length) return null;
                return acts[Math.floor(Math.random() * acts.length)];
            },
            cooldown: r.cooldown
        };
    });
}

/* ---------------- 状态策略 ---------------- */

var whenCache = typeof WeakMap === 'function' ? new WeakMap() : null;

function matchWhen(when, ctx) {
    if (!when) return true;
    var fn = whenCache && typeof when === 'object' ? whenCache.get(when) : null;
    if (!fn) {
        fn = PetRules.compileWhen(PetRules.normalizeWhen(when));
        if (whenCache && typeof when === 'object') whenCache.set(when, fn);
    }
    return fn(ctx || {}, {});
}

function pickState(ctx) {
    var rules = (PetConfig && PetConfig.policy && PetConfig.policy.stateRules) || [];
    for (var i = 0; i < rules.length; i++) {
        if (rules[i].enabled === false) continue;
        if (matchWhen(rules[i].when, ctx || {})) return rules[i].state;
    }
    var states = (PetConfig && PetConfig.states) || {};
    var pool = [];
    var total = 0;
    Object.keys(states).forEach(function (id) {
        var v = states[id] || {};
        var w = Number(v.weight);
        if (!Number.isFinite(w) || w <= 0) return;
        pool.push({ id: id, w: w });
        total += w;
    });
    if (!total) return 'idle';
    var t = Math.random() * total;
    for (var j = 0; j < pool.length; j++) {
        t -= pool[j].w;
        if (t <= 0) return pool[j].id;
    }
    return pool[pool.length - 1].id;
}

function holiday(now) {
    var d = now || new Date();
    var key = (d.getMonth() + 1) + '-' + d.getDate();
    var cal = (PetConfig && PetConfig.policy && PetConfig.policy.calendar) || {};
    return cal[key] || null;
}

/* ==================== 站点上下文 ====================
 * 站点语义（type/path/title）来自 SiteAPI.currentContext()，
 * 文章元信息（tags/字数是按需从内容库取，滚动比例来自阅读位置事件）。
 * 全部异步，所以这里维护一份同步缓存给规则引擎读。
 */

var cache = {
    ctx: null,          // 给规则用的同步快照
    site: null,         // SiteAPI 原始上下文
    doc: null,          // 文章元信息（可能为 null）
    docPath: null,
    docLoading: null,
    scroll: 0,
    hour: new Date().getHours()
};

function emptyCtx() {
    return {
        page: 'other', type: 'other', path: '/', title: '', id: '',
        tags: [], words: 0, comments: null, dark: null,
        scroll: 0, hour: new Date().getHours()
    };
}

function pageTypeOf(site) {
    var type = String((site && site.type) || 'page');
    var p = String((site && site.path) || '/');
    if (type === 'post') return 'post';
    if (type === 'paper') return 'paper';
    if (type === 'algorithm') return 'algorithm';
    if (type === 'mock') return 'mock';
    if (/^\/tags\//.test(p)) return 'tag';
    if (/^\/categories\//.test(p)) return 'category';
    if (p === '/' || p === '/index.html') return 'home';
    if (/404/.test(p)) return '404';
    return 'other';
}

/** 标签名：从路径里取，不查 DOM（/tags/Unity/ → Unity） */
function tagName() {
    var p = (cache.ctx && cache.ctx.path) || (cache.site && cache.site.path) || '';
    var m = String(p).match(/\/(?:tags|categories)\/([^/]+?)\/?(?:index\.html)?$/);
    if (!m) return '';
    try {
        return decodeURIComponent(m[1]);
    } catch (e) {
        return m[1];
    }
}

function metaOf(type) {
    return type === 'post' || type === 'paper' || type === 'knowledge' || type === 'algorithm';
}

/** 只读 SiteAPI 的页面上下文，构造规则用的快照 */
function context() {
    if (cache.ctx) return cache.ctx;
    return emptyCtx();
}

function recompute() {
    var site = cache.site || {};
    var type = pageTypeOf(site);
    var doc = (cache.doc && cache.docPath === site.path) ? cache.doc : null;
    cache.ctx = {
        page: type === 'post' ? 'post' : (type === 'home' ? 'home' : 'other'),
        type: type,
        path: site.path || '/',
        title: site.title || '',
        id: site.id || '',
        tags: (doc && Array.isArray(doc.tags)) ? doc.tags.slice(0, 12) : [],
        words: (doc && Number(doc.word_count)) || 0,
        comments: null,          // SiteAPI 不提供评论数：相关规则自然不命中
        dark: null,              // 主题不在上下文里：相关规则自然不命中
        scroll: cache.scroll,
        hour: new Date().getHours()
    };
    return cache.ctx;
}

/* 哪些字段真的会被用到：配置里的规则 + 内置上下文规则 */
function rulesNeed(field) {
    var keys = [field];
    var lists = [
        (PetConfig && PetConfig.rules && PetConfig.rules.items) || [],
        (PetConfig && PetConfig.policy && PetConfig.policy.stateRules) || []
    ];
    for (var i = 0; i < lists.length; i++) {
        for (var j = 0; j < lists[i].length; j++) {
            var when = lists[i][j].when || {};
            for (var k = 0; k < keys.length; k++) {
                if (Object.prototype.hasOwnProperty.call(when, keys[k])) return true;
            }
        }
    }
    return false;
}

/**
 * 文章元信息按需加载：只有规则里真的用到了 tags/words 才去内容库取。
 * 取一次缓存一页；失败就当没有，不重试、不阻塞。
 */
function loadMeta() {
    var cfg = (PetConfig && PetConfig.site) || {};
    if (cfg.postMeta === false) return Promise.resolve(null);
    var path = cache.site && cache.site.path;
    if (!path || !metaOf(pageTypeOf(cache.site))) return Promise.resolve(null);
    if (cache.doc && cache.docPath === path) return Promise.resolve(cache.doc);
    if (cache.docLoading) return cache.docLoading;
    if (!rulesNeed('tagsAny') && !rulesNeed('wordsGt') && !rulesNeed('wordsLt')) {
        return Promise.resolve(null);
    }
    cache.docLoading = ensureReady().then(function () {
        return PetSite.documentByPath(path);
    }).then(function (doc) {
        cache.docLoading = null;
        if (doc) {
            cache.doc = doc;
            cache.docPath = path;
            recompute();
        }
        return doc;
    }).catch(function () {
        cache.docLoading = null;
        return null;
    });
    return cache.docLoading;
}

/* ---------------- 站点就绪（节流） ----------------
 * SiteAPI.ready() 会让站点加载内容库（content-db.json，5MB 级），
 * 所以不在首屏调用：等到"需要内容"或者过了 readyDelayMs 再来。
 */
var readyPromise = null;

function ensureReady() {
    if (!PetSite.available()) return Promise.resolve(false);
    if (!readyPromise) readyPromise = PetSite.ready();
    return readyPromise;
}

/** 主动刷新一次站点上下文（pjax / context:change 之后） */
function refresh() {
    if (!PetSite.available()) return Promise.resolve(context());
    return PetSite.context().then(function (site) {
        cache.site = site || null;
        recompute();
        return context();
    }).catch(function () {
        return context();
    });
}

/** 启动：等站点就绪 → 首次上下文 → 订阅站点事件 */
function init() {
    if (!PetSite.available()) {
        cache.ctx = emptyCtx();
        return Promise.resolve(cache.ctx);
    }
    var started = refresh();

    // 站点自己会发这些事件，宠物只订阅，不自己轮询 DOM
    PetSite.on('context:change', function (site) {
        cache.site = site || cache.site;
        recompute();
    });
    PetSite.on('navigation:open', function () {
        refresh();
    });
    PetSite.on('reading:position', function (row) {
        if (row && typeof row.ratio === 'number') cache.scroll = row.ratio;
    });

    // 阅读位置事件是节流的，滚动停了才发一次；这里补一个低频兜底
    var timer = setInterval(function () {
        var r = PetSite.reading();
        if (!r || typeof r.get !== 'function') return;
        try {
            var row = r.get();
            if (row && typeof row.ratio === 'number') cache.scroll = row.ratio;
        } catch (e) { /* ignore */ }
    }, 4000);
    timer.unref && timer.unref();

    return started.then(function () {
        var cfg = (PetConfig && PetConfig.site) || {};
        var delay = Number(cfg.readyDelayMs);
        if (!Number.isFinite(delay) || delay < 0) delay = 6000;

        // 到点再让站点就绪：阅读位置跟踪也在这之后才开始
        setTimeout(function () {
            ensureReady().then(function () { refresh(); });
        }, delay);

        // 元信息更晚：先让页面喘口气
        setTimeout(function () { loadMeta(); }, delay + 2000);
        return context();
    });
}

/* ---------------- 兼容旧接口（index.js 里还在用） ---------------- */

function pageType() { return context().type; }
function tags() { return context().tags; }
function wordCount() { return context().words; }
function commentCount() { return context().comments; }
function scrollRatio() { return cache.scroll; }
function headingText() { return tagName(); }
function tagFromPath() { return tagName(); }

/** 主题：SiteAPI 没有这个字段，所以永远是"不知道" */
function isDark() { return null; }
function onThemeChange() { return function () {}; }

/* ---------------- 本地状态（走 userState，不自建存储） ---------------- */

function rawGet(key, fallback) {
    var v = PetSite.get('pet.' + key, null);
    return v === null ? (fallback === undefined ? null : fallback) : v;
}

function rawSet(key, value) {
    return PetSite.set('pet.' + key, value);
}

function rawRemove(key) {
    return PetSite.remove('pet.' + key);
}

/* 会话级标记：SiteAPI 没有 sessionStorage，用"带时间戳的本地标记"近似 */
var SESSION_TTL = 30 * 60 * 1000;

function sessionGet(key) {
    var row = PetSite.get('pet.' + key, null);
    if (!row || typeof row !== 'object') return row;
    if (!row.at || Date.now() - row.at > SESSION_TTL) return null;
    return row.v === undefined ? true : row.v;
}

function sessionSet(key, value) {
    return PetSite.set('pet.' + key, { v: value, at: Date.now() });
}

/* ---------------- 上下文规则（站点知识） ---------------- */

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function keywordsOf(name) {
    return C.list('adapter.keywords.' + name);
}

var CTX_RULES = [
    {
        id: 'post.unity',
        when: function (c) { return c.page === 'post' && PetRules.matchTag(c.tags, keywordsOf('unity')); },
        say: function () { return C.t('adapter.unity'); }
    },
    {
        id: 'post.algorithm',
        when: function (c) { return c.page === 'post' && PetRules.matchTag(c.tags, keywordsOf('algorithm')); },
        say: function () { return C.t('adapter.algorithm'); }
    },
    {
        id: 'post.finished',
        when: function (c) { return c.page === 'post' && c.scroll > 0.85; },
        say: function () { return C.pick('adapter.finished'); },
        act: 'look'
    },
    {
        id: 'post.long',
        when: function (c) { return c.page === 'post' && c.words > 4000; },
        say: function () { return C.pick('adapter.long'); },
        act: function () { return pick(['think', 'doze']); }
    },
    {
        id: 'post.short',
        when: function (c) { return c.page === 'post' && c.words > 0 && c.words < 600; },
        say: function () { return C.pick('adapter.short'); },
        act: 'look'
    },
    {
        id: 'home.late',
        when: function (c) { return c.page === 'home' && c.hour >= 23; },
        say: function () { return C.t('adapter.late'); },
        act: 'doze'
    },
    {
        id: 'home.streak',
        when: function (c, env) { return c.page === 'home' && (env.streak || 1) >= 3; },
        say: function (c, env) { return C.t('adapter.streak', { n: env.streak }); }
    },
    {
        id: 'post.backToTop',
        when: function (c, env) { return c.page === 'post' && env.lastScroll > 0.8 && c.scroll < 0.25; },
        say: function () { return C.pick('adapter.backTop'); },
        act: 'stretch'
    },
    {
        id: 'page.tag',
        when: function (c) { return c.type === 'tag'; },
        say: function () {
            var name = tagName();
            if (!name) return '';
            return C.pick('adapter.tag').replace(/\{name\}/g, name);
        },
        act: 'hum'
    },
    {
        id: 'page.404',
        when: function (c) { return c.type === '404'; },
        say: function () { return C.pick('adapter.notFound'); },
        act: function () { return pick(['puzzle', 'angry']); }
    }
];

export const PetAdapter = {
    /* 站点能力 */
    init: init,
    refresh: refresh,
    context: context,
    ensureReady: ensureReady,
    loadMeta: loadMeta,
    available: function () { return PetSite.available(); },
    site: PetSite,

    /* 规则与状态 */
    rules: buildRules(),
    pickState: pickState,
    holiday: holiday,

    /* 兼容旧接口 */
    pageType: pageType,
    tags: tags,
    wordCount: wordCount,
    commentCount: commentCount,
    scrollRatio: scrollRatio,
    headingText: headingText,
    tagFromPath: tagFromPath,
    tagName: tagName,
    isDark: isDark,
    onThemeChange: onThemeChange,

    /* 存储 */
    rawGet: rawGet,
    rawSet: rawSet,
    rawRemove: rawRemove,
    sessionGet: sessionGet,
    sessionSet: sessionSet
};

export default PetAdapter;
