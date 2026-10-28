/*!
 * 站点适配层（Site Adapter）
 *
 * 唯一允许接触站点的地方：DOM 选择器、URL、localStorage 都收敛在这里。
 * 宠物本体只调用 PetAdapter 暴露的方法，不直接读站点。
 *
 * 目标：换站点时只重写这个文件。
 * 当前阶段只是"搬家"——行为与搬家前完全一致。
 */
    

import PetConfig from './config.js';
import { PetRules } from './modules/rules.js';
import { PetContent } from './content/index.js';

const C = PetContent;

    /* 规则来自配置：when 编译成断言，say 走模板，act 支持数组随机 */
    function buildRules() {
        var items = (PetConfig && PetConfig.rules && PetConfig.rules.items) || [];
        return items.map(function (r) {
            var acts = Array.isArray(r.act) ? r.act : (r.act == null ? [] : [r.act]);
            return {
                id: r.id,
                when: PetRules.compileWhen(r.when),
                say: function (ctx, env) {
                    var e = Object.assign({}, env || {}, { tagName: headingText() || tagFromPath() });
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

    /* ---------------- 状态策略（站点层） ----------------
     * 宠物只认状态 id；"什么时候进入哪个状态"由这里根据配置回答。
     */
    /* 别名归一化在运行时里（PetRules.normalizeWhen），这里只做缓存：
     * 同一个 when 对象只编译一次，pickState 会被频繁调用。 */
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
            if (rules[i].enabled === false) continue;   // 停用的规则跳过
            if (matchWhen(rules[i].when, ctx || {})) return rules[i].state;
        }
        // 没有规则命中时，按状态自身的 weight 加权；全都没写就还是待机
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

    /* ---------------- URL / 页面类型 ---------------- */

    function path() {
        return location.pathname || '/';
    }

    /** post | tag | category | home | other */
    function pageType() {
        var p = path();
        if (/^\/\d{4}\/\d{2}\/\d{2}\//.test(p) || /\/archives\/\d+/.test(location.href)) return 'post';
        if (/^\/(tags|categories)\//.test(p)) return /^\/categories\//.test(p) ? 'category' : 'tag';
        if (p === '/' || p === '/index.html') return 'home';
        if (/404/.test(p)) return '404';
        return 'other';
    }

    /* ---------------- 内容元信息 ---------------- */

    function tags() {
        var out = [];
        try {
            var nodes = document.querySelectorAll(
                '.post-categories a, .post-tags a, .category a, .tag-cloud a, #article-container .tag a'
            );
            for (var i = 0; i < nodes.length && out.length < 12; i++) {
                var t = (nodes[i].textContent || '').trim();
                if (t) out.push(t);
            }
        } catch (e) { /* ignore */ }
        return out;
    }

    function wordCount() {
        try {
            var body = document.querySelector('#article-container') || document.querySelector('.post-content');
            if (!body) return 0;
            return (body.textContent || '').replace(/\s/g, '').length;
        } catch (e) {
            return 0;
        }
    }

    function commentCount() {
        try {
            return document.querySelectorAll('#post-comment .comment, #post-comment .vcomment, .comment-list > li').length;
        } catch (e) {
            return 0;
        }
    }

    /** 页面标题（标签页/分类页用） */
    function headingText() {
        try {
            var h = document.querySelector('#page h1, .page-title, #article-container h1, .tag-cloud-title, h1');
            return h ? (h.textContent || '').trim().slice(0, 20) : '';
        } catch (e) {
            return '';
        }
    }

    /** 从 URL 兜底解析标签名：/tags/Unity/ → Unity */
    function tagFromPath() {
        try {
            var m = decodeURIComponent(path()).match(/\/(?:tags|categories)\/([^/]+?)\/?(?:\.html)?$/);
            return m ? m[1].replace(/\.html$/, '') : '';
        } catch (e) {
            return '';
        }
    }

    /* ---------------- 阅读进度 ---------------- */

    function scrollRatio() {
        try {
            var h = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
            return Math.min(1, Math.max(0, (window.scrollY || 0) / h));
        } catch (e) {
            return 0;
        }
    }

    /* ---------------- 主题 ---------------- */

    function isDark() {
        try {
            var root = document.documentElement;
            var theme = root.getAttribute('data-theme');
            if (theme) return theme === 'dark';
            if (root.classList.contains('dark') || document.body.classList.contains('dark')) return true;
            return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        } catch (e) {
            return false;
        }
    }

    /** 主题变化回调；返回解绑函数 */
    function onThemeChange(cb) {
        try {
            var ob = new MutationObserver(cb);
            ob.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'data-color'] });
            return function () { ob.disconnect(); };
        } catch (e) {
            return function () {};
        }
    }

    /* ---------------- 持久化 ---------------- */

    var PREFIX = 'dp:';

    function rawGet(key) {
        try { return localStorage.getItem(PREFIX + key); } catch (e) { return null; }
    }

    function rawSet(key, value) {
        try { localStorage.setItem(PREFIX + key, value); } catch (e) { /* 隐私模式 */ }
    }

    function rawRemove(key) {
        try { localStorage.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
    }

    function sessionGet(key) {
        try { return sessionStorage.getItem(PREFIX + key); } catch (e) { return null; }
    }

    function sessionSet(key, value) {
        try { sessionStorage.setItem(PREFIX + key, value); } catch (e) { /* ignore */ }
    }

    /* ---------------- 鼠标是否在宠物附近 ---------------- */
    // 预留：站点只提供坐标，判断逻辑在宠物侧

    /* 规则里用的随机取一，避免依赖宠物的内部工具函数 */

    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    /* 关键词也进文案文件：换语言/换站点只改 content，不动这里的匹配逻辑 */
    function keywordsOf(name) {
        return C.list('adapter.keywords.' + name);
    }

    /* ---------------- 上下文规则（站点知识） ----------------
     * 只有这一层知道"文章""标签""404"意味着什么。
     * 结构：{ id, when(ctx, env), say, act, cooldown }
     * when/say/act 可以是值或函数，函数签名 (ctx, env)。
     */
    var CTX_RULES = [
    {
        id: 'post.unity',
        when: function (c) { return c.page === 'post' && window.PetRules.matchTag(c.tags, keywordsOf('unity')); },
        say: function () { return C.t('adapter.unity'); }
    },
    {
        id: 'post.algorithm',
        when: function (c) { return c.page === 'post' && window.PetRules.matchTag(c.tags, keywordsOf('algorithm')); },
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
        id: 'post.noComment',
        when: function (c) { return c.page === 'post' && c.comments === 0 && c.scroll > 0.5; },
        say: function () { return C.t('adapter.noComment'); }
    },
    {
        id: 'post.hot',
        when: function (c) { return c.page === 'post' && c.comments >= 3; },
        say: function () { return C.t('adapter.hot'); },
        act: 'hum'
    },
    {
        id: 'home.late',
        when: function (c) { return c.page === 'home' && c.dark && c.hour >= 23; },
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
        say: function (c, env) {
            var name = env.adapter.headingText() || env.adapter.tagFromPath();
            if (!name) return '';
            var tpl = C.pick('adapter.tag');
            return tpl.replace(/\{name\}/g, name);
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
        rules: buildRules(),
        path: path,
        pageType: pageType,
        tags: tags,
        wordCount: wordCount,
        commentCount: commentCount,
        headingText: headingText,
        tagFromPath: tagFromPath,
        pickState: pickState,
        holiday: holiday,
        scrollRatio: scrollRatio,
        isDark: isDark,
        onThemeChange: onThemeChange,
        rawGet: rawGet,
        rawSet: rawSet,
        rawRemove: rawRemove,
        sessionGet: sessionGet,
        sessionSet: sessionSet
    };
