/*!
 * mock-site.js —— 演示页上的 SiteAPI 假实现（对齐 1.1.0 契约）
 *
 * 只在 demo.html?mock=1 时加载，用来在没有博客的情况下验证
 * "宠物只通过 window.SiteAPI 说话"这条链路：
 * 上下文元数据、轻量 ready、按需 readyContent、检索、阅读位置、动作、本地状态。
 *
 * 它不是站点的替代品，只是让契约可测。
 */
(function (global) {
    'use strict';

    var listeners = Object.create(null);
    var store = Object.create(null);

    var state = {
        ctx: {
            type: 'post', id: 'mock-post', contentId: 'post:_posts/mock.md',
            title: '演示用的文章', path: '/posts/mock/',
            tags: ['Unity', 'C#'], categories: ['技术'],
            wordCount: 5200, comments: 0, commentsAvailable: false,
            theme: 'light'
        },
        scroll: 0,
        bookmarks: [],
        contentLoaded: false
    };

    var DOCS = [
        { type: 'post', id: 'post:mock-1', title: '演示用的文章', path: '/posts/mock/', tags: ['Unity', 'C#'], word_count: 5200 },
        { type: 'post', id: 'post:mock-2', title: '对象池与内存抖动', path: '/posts/mock-2/', tags: ['Unity'], word_count: 1800 },
        { type: 'knowledge', id: 'card:mock', title: '对象池设计的关键边界', path: '/knowledge/#mock', tags: [], word_count: 0 },
        { type: 'question', id: 'q:mock', title: '对象池设计的关键是？', path: '/questions/', paperId: 'mock-paper', questionId: 'q:mock', tags: [], word_count: 0 }
    ];

    function emit(type, detail) {
        (listeners[type] || []).slice().forEach(function (fn) {
            try { fn(detail); } catch (e) { /* ignore */ }
        });
        try { global.dispatchEvent(new CustomEvent('site:' + type, { detail: detail })); } catch (e) { /* ignore */ }
    }

    function fail(code, message) {
        var err = new Error(message);
        err.code = code;
        return Promise.reject(err);
    }

    var actions = [
        { id: 'navigation.open', label: '打开站内页面', scope: 'read', description: '', requiresConfirmation: false },
        { id: 'navigation.openQuestion', label: '打开题目', scope: 'read', description: '', requiresConfirmation: false },
        { id: 'bookmark.toggle', label: '收藏', scope: 'write-local', description: '', requiresConfirmation: false },
        { id: 'reading.restore', label: '恢复阅读位置', scope: 'read-local', description: '', requiresConfirmation: false }
    ];

    global.SiteAPI = {
        version: '1.1.0-mock',

        ready: function () {
            return Promise.resolve(true);
        },

        readyContent: function () {
            state.contentLoaded = true;
            return Promise.resolve(true);
        },

        health: function () {
            return Promise.resolve({
                modules: { content: true, navigation: true, actions: true, events: true, reading: true },
                storage: { bookmarks: state.bookmarks.length }
            });
        },

        capabilities: function () {
            return Promise.resolve({
                apiVersion: '1.1.0',
                contextFields: ['type', 'id', 'contentId', 'title', 'path', 'tags', 'categories', 'wordCount', 'comments', 'commentsAvailable', 'theme'],
                actions: actions.map(function (a) { return a.id; }),
                capabilities: [
                    { id: 'content.search', scope: 'read', description: '检索' },
                    { id: 'navigation.open', scope: 'read', description: '导航' }
                ]
            });
        },

        currentContext: function () {
            return Promise.resolve(JSON.parse(JSON.stringify(state.ctx)));
        },

        content: function () {
            return {
                search: function (query, opts) {
                    var q = String(query || '').toLowerCase();
                    var limit = (opts && opts.limit) || 3;
                    /* 假实现也要宽容：按 2 字滑窗切开，命中任意片段就算相关 */
                    var terms = [];
                    q.split(/\s+/).filter(Boolean).forEach(function (seg) {
                        if (seg.length <= 2) { terms.push(seg); return; }
                        for (var i = 0; i + 2 <= seg.length; i += 1) terms.push(seg.substr(i, 2));
                    });
                    var rows = DOCS.filter(function (d) {
                        if (!terms.length) return true;
                        var hay = (d.title + ' ' + d.tags.join(' ') + ' ' + d.path).toLowerCase();
                        return terms.some(function (term) { return hay.indexOf(term) >= 0; });
                    }).slice(0, limit).map(function (d) {
                        var row = { type: d.type, id: d.id, title: d.title, path: d.path, snippet: '', score: 1 };
                        if (d.paperId) { row.paperId = d.paperId; row.questionId = d.questionId; }
                        return row;
                    });
                    return Promise.resolve(rows);
                },
                list: function (type, filters) {
                    var where = (filters && filters.where) || {};
                    var rows = DOCS.filter(function (d) {
                        return Object.keys(where).every(function (k) { return d[k] === where[k]; });
                    });
                    return Promise.resolve(rows);
                },
                get: function (type, id) {
                    var hit = DOCS.filter(function (d) { return d.id === id; })[0] || null;
                    return Promise.resolve(hit ? { type: hit.type, id: hit.id, title: hit.title, path: hit.path, data: hit } : null);
                }
            };
        },

        navigation: function () {
            return {
                current: function () {
                    return { url: state.ctx.path, path: state.ctx.path, hash: '', search: '', type: state.ctx.type, title: state.ctx.title };
                },
                open: function (path) {
                    state.ctx.path = path;
                    emit('navigation:open', { path: path });
                    return true;
                }
            };
        },

        actions: function () {
            return {
                list: function () {
                    return actions.slice();
                },
                invoke: function (id, payload) {
                    if (id === 'navigation.open') {
                        state.ctx.path = (payload && payload.path) || state.ctx.path;
                        emit('navigation:open', { path: state.ctx.path });
                        return Promise.resolve(true);
                    }
                    if (id === 'navigation.openQuestion') {
                        state.ctx.path = '/questions/#' + encodeURIComponent((payload && payload.questionId) || '');
                        return Promise.resolve(true);
                    }
                    if (id === 'bookmark.toggle') {
                        var key = (payload && payload.id) || 'x';
                        var at = state.bookmarks.indexOf(key);
                        if (at >= 0) state.bookmarks.splice(at, 1);
                        else state.bookmarks.push(key);
                        return Promise.resolve({ active: at < 0, key: key });
                    }
                    return fail('E_UNKNOWN_ACTION', '未知操作：' + id);
                }
            };
        },

        events: function () {
            return {
                on: function (type, fn) {
                    if (!listeners[type]) listeners[type] = [];
                    listeners[type].push(fn);
                    return function () {
                        listeners[type] = (listeners[type] || []).filter(function (f) { return f !== fn; });
                    };
                },
                emit: emit
            };
        },

        reading: function () {
            return {
                get: function () {
                    return { path: state.ctx.path, ratio: state.scroll, scrollY: 0, title: state.ctx.title, at: new Date().toISOString() };
                },
                save: function () { return this.get(); },
                restore: function () { return true; },
                start: function () { return true; }
            };
        },

        userState: function () {
            return {
                get: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
                set: function (k, v) { store[k] = v; return true; },
                remove: function (k) { delete store[k]; return true; },
                keys: function () { return Object.keys(store); },
                clear: function () { store = Object.create(null); return true; }
            };
        },

        bookmarks: function () {
            return { list: function () { return state.bookmarks.slice(); } };
        }
    };

    /* 面板用的开关：改上下文 / 改滚动 / 切主题 / 看状态 */
    global.mockSite = {
        state: state,
        setContext: function (ctx) {
            state.ctx = Object.assign({}, state.ctx, ctx);
            emit('context:change', state.ctx);
        },
        setScroll: function (ratio) {
            state.scroll = Math.max(0, Math.min(1, ratio));
            emit('reading:position', { path: state.ctx.path, ratio: state.scroll, scrollY: 0, title: state.ctx.title });
        },
        setTheme: function (theme) {
            state.ctx.theme = theme;
            emit('context:change', JSON.parse(JSON.stringify(state.ctx)));
        },
        emit: emit
    };
})(window);
