/*!
 * site.js —— 宠物与站点之间的唯一出口
 *
 * 规则只有一条：**只通过 window.SiteAPI 对话**。
 * 这里不查 DOM、不读 content-db、不碰站点内部对象；
 * 站点没提供的能力就当作没有，而不是绕过去。
 *
 * 所有方法在 SiteAPI 不存在时都返回安全空值，所以同一份代码也能在没有站点的
 * 空白页（本地演示页）里跑，只是能力变少。
 *
 * 权限约定（见 SITE_API_INTEGRATION_GUIDE.md）：
 *   read        只读公共内容      → context / search / document
 *   read-local  读本机数据        → reading / bookmarks
 *   write-local 改本机数据        → userState / bookmarks / notes / reading.save
 * 写操作一律走 actions().invoke，并且**不伪造 confirmed**：
 * 需要确认的交给 SiteAPI 自己弹窗，用户拒绝就当没做。
 */

function api() {
    return (typeof window !== 'undefined' && window.SiteAPI) || null;
}

function moduleOf(name) {
    const a = api();
    if (!a) return null;
    try {
        return typeof a[name] === 'function' ? a[name]() : null;
    } catch (e) {
        return null;
    }
}

export const PetSite = {
    /** 站点是否接入了 SiteAPI */
    available() {
        return !!api();
    },

    version() {
        const a = api();
        return a && a.version ? String(a.version) : null;
    },

    /** 等站点就绪（1.1 起是轻量的，不加载内容库）；没有站点直接 resolve(false) */
    ready() {
        const a = api();
        if (!a || typeof a.ready !== 'function') return Promise.resolve(false);
        return Promise.resolve(a.ready()).then(() => true).catch(() => false);
    },

    /** 显式加载内容库：只在按 ID 取详情、需要全文时才调 */
    readyContent() {
        const a = api();
        if (!a || typeof a.readyContent !== 'function') return Promise.resolve(false);
        return Promise.resolve(a.readyContent()).then(() => true).catch(() => false);
    },

    capabilities() {
        const a = api();
        if (!a || typeof a.capabilities !== 'function') return Promise.resolve({ apiVersion: null, capabilities: [] });
        return Promise.resolve(a.capabilities()).catch(() => ({ apiVersion: null, capabilities: [] }));
    },

    health() {
        const a = api();
        if (!a || typeof a.health !== 'function') return Promise.resolve(null);
        return Promise.resolve(a.health()).catch(() => null);
    },

    /* ---------------- read：页面语义 ---------------- */

    context() {
        const a = api();
        if (!a || typeof a.currentContext !== 'function') return Promise.resolve(null);
        return Promise.resolve(a.currentContext()).catch(() => null);
    },

    navigation() {
        const a = api();
        if (!a || typeof a.navigation !== 'function') return null;
        return a.navigation();
    },

    /* ---------------- read：内容 ---------------- */

    /** 统一搜索，返回 [{type,id,title,path,snippet,score}] */
    search(query, opts) {
        const c = moduleOf('content');
        const limit = Math.max(1, Math.min(10, Number(opts && opts.limit) || 3));
        if (!c || typeof c.search !== 'function') return Promise.resolve([]);
        const options = { limit: limit };
        if (opts && Array.isArray(opts.types)) options.types = opts.types;
        return Promise.resolve(c.search(query, options))
            .then((rows) => (Array.isArray(rows) ? rows : []))
            .catch(() => []);
    },

    /** 按路径取内容条目（文章元信息：tags / word_count / id） */
    documentByPath(path) {
        const c = moduleOf('content');
        if (!c || typeof c.list !== 'function' || !path) return Promise.resolve(null);
        return Promise.resolve(c.list('document', { where: { path: path }, limit: 1 }))
            .then((rows) => (Array.isArray(rows) && rows.length ? rows[0] : null))
            .catch(() => null);
    },

    get(type, id) {
        const c = moduleOf('content');
        if (!c || typeof c.get !== 'function' || !id) return Promise.resolve(null);
        return Promise.resolve(c.get(type, id)).catch(() => null);
    },

    /* ---------------- read-local：本机数据 ---------------- */

    reading() {
        return moduleOf('reading');
    },

    bookmarks() {
        return moduleOf('bookmarks');
    },

    notes() {
        return moduleOf('notes');
    },

    quiz() {
        return moduleOf('quiz');
    },

    stats() {
        return moduleOf('stats');
    },

    /* ---------------- 本地键值（走 userState，不自建存储） ---------------- */

    store() {
        return moduleOf('userState');
    },

    get(key, fallback) {
        const s = this.store();
        if (!s || typeof s.get !== 'function') return fallback;
        try {
            const v = s.get(key);
            return v === null || v === undefined ? fallback : v;
        } catch (e) {
            return fallback;
        }
    },

    set(key, value) {
        const s = this.store();
        if (!s || typeof s.set !== 'function') return false;
        try {
            s.set(key, value);
            return true;
        } catch (e) {
            return false;
        }
    },

    remove(key) {
        const s = this.store();
        if (!s || typeof s.remove !== 'function') return false;
        try {
            s.remove(key);
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * Storage 形状的适配器（getItem/setItem/removeItem），给内核的持久化层用。
     * 没有 SiteAPI 时返回 null，调用方自己决定退回什么。
     */
    storageBackend(prefix) {
        if (!this.store()) return null;
        const p = prefix || 'kv.';
        return {
            getItem: (key) => {
                const v = this.get(p + key, null);
                return v === null ? null : v;
            },
            setItem: (key, value) => this.set(p + key, value),
            removeItem: (key) => this.remove(p + key)
        };
    },

    /* ---------------- 写：一律走 actions().invoke ---------------- */

    actions() {
        const a = api();
        if (!a || typeof a.actions !== 'function') return null;
        return a.actions();
    },

    /** 站点注册了哪些操作（含 scope / 是否需要确认） */
    actionList() {
        const acts = this.actions();
        if (!acts || typeof acts.list !== 'function') return [];
        try {
            return acts.list() || [];
        } catch (e) {
            return [];
        }
    },

    hasAction(id) {
        return this.actionList().some((x) => x.id === id);
    },

    /**
     * 调用站点操作。默认**不传 confirmed**：
     * 需要用户确认的操作会让 SiteAPI 自己弹窗，用户点「取消」就 reject。
     */
    action(id, payload, opts) {
        const acts = this.actions();
        if (!acts || typeof acts.invoke !== 'function') {
            return Promise.reject(new Error('SiteAPI.actions unavailable'));
        }
        const options = Object.assign({}, opts || {});
        return Promise.resolve(acts.invoke(id, payload || {}, options))
            .then((res) => ({ ok: true, result: res }))
            .catch((err) => ({
                ok: false,
                /* 1.1 起站点给稳定错误码；老站点只有 message */
                code: (err && err.code) || '',
                error: String((err && err.message) || err)
            }));
    },

    /** 语义导航：不拼 URL、不点链接 */
    navigate(path) {
        if (!path) return Promise.resolve(false);
        return this.action('navigation.open', { path: path }).then((r) => {
            if (r && r.ok) return true;
            /* 站点还没 ready() 时 navigation.open 可能尚未注册；
               退回语义导航接口，同样是 SiteAPI 的一部分 */
            const nav = this.navigation();
            if (nav && typeof nav.open === 'function') {
                try {
                    nav.open(path);
                    return true;
                } catch (e) {
                    return false;
                }
            }
            return false;
        });
    },

    /* ---------------- read：事件 ---------------- */

    on(event, fn) {
        const e = moduleOf('events');
        if (!e || typeof e.on !== 'function') return function () {};
        try {
            const off = e.on(event, fn);
            return typeof off === 'function' ? off : function () { e.off && e.off(event, fn); };
        } catch (err) {
            return function () {};
        }
    }
};

export default PetSite;
