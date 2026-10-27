/*!
 * PetKernel —— 宠物内核
 *
 * 职责只有四件事：装配模块、分发事件、裁决意图、提供存储。
 * 它不认识任何具体动作、台词或站点信息。
 *
 * 设计约束（来自 HANDOFF.md）：
 *   1. 模块不能直接改宠物状态：动身体发 intent.action，说话发 speech.act
 *   2. 单一身体所有权：同一时刻只有一个动作生效，冲突方收到 rejected
 *   3. 内核 ≤ 300 行，不做沙箱、不动态下载模块
 */


    /* 每个实例一份内核：事件总线、动作裁决、存储互不干扰 */
    function createKernel() {
        /* ---------------- 事件总线 ---------------- */

        var listeners = {};

        function on(type, fn) {
            (listeners[type] || (listeners[type] = [])).push(fn);
            return function off() {
                var arr = listeners[type];
                if (!arr) return;
                var i = arr.indexOf(fn);
                if (i >= 0) arr.splice(i, 1);
            };
        }

        function emit(type, payload) {
            var arr = listeners[type];
            if (!arr || !arr.length) return;
            // 拷贝一份，避免回调里增删监听导致跳过
            arr.slice().forEach(function (fn) {
                try {
                    fn(payload);
                } catch (e) {
                    log('error', type, e && e.message);
                }
            });
        }

        /* ---------------- 调试日志（环形缓冲） ---------------- */

        var LOG_MAX = 200;
        var logBuf = [];

        function log(kind, type, extra) {
            logBuf.push({ t: Date.now(), kind: kind, type: type, extra: extra });
            if (logBuf.length > LOG_MAX) logBuf.shift();
        }

        function logList() {
            return logBuf.slice();
        }

        /* ---------------- 动作调度 ---------------- */

        // 数字越大越强势：hold 可以打断一切，ambient 可以被任何东西打断
        var LEVEL = { ambient: 1, scheduled: 2, direct: 3, hold: 4 };

        /**
         * 意图级别：底层只认数值，名字是人为约定的解释。
         * 数值越大越强势；可以传任意数值（如 2.5），也可以用 defineLevel 注册新名字。
         */
        function normalizeLevel(level) {
            if (typeof level === 'number' && isFinite(level)) return level;
            if (typeof level === 'string' && Object.prototype.hasOwnProperty.call(LEVEL, level)) return LEVEL[level];
            return LEVEL.scheduled;
        }

        /** 注册一个具名级别，便于业务层自解释 */
        function defineLevel(name, value) {
            if (typeof name !== 'string' || typeof value !== 'number') return false;
            LEVEL[name] = value;
            return true;
        }

        var current = null;   // { act, level, until, token }
        var tokenSeq = 0;

        /**
         * 请求执行动作。
         * @returns {boolean} 是否被接受
         */
        function requestAction(req) {
            var act = req && req.act;
            if (!act) return false;
            var level = normalizeLevel(req.level);
            var now = Date.now();

            // 当前动作还没结束，且级别更高 → 拒绝
            if (current && current.level > level && current.until > now) {
                emit('intent.rejected', { act: act, level: req.level, by: current.act });
                log('reject', act, current.act);
                return false;
            }

            var token = ++tokenSeq;
            current = {
                act: act,
                level: level,
                until: now + (req.duration || 0),
                token: token
            };
            emit('action', { act: act, level: req.level, duration: req.duration || 0, token: token });
            log('action', act, req.level);
            return true;
        }

        /** 持续状态（拖拽这类）：hold 住直到 release */
        function holdAction(req) {
            var ok = requestAction({
                act: req.act,
                level: 'hold',
                duration: 1e9
            });
            if (ok) emit('action.hold', { act: req.act });
            return ok;
        }

        function releaseAction(req) {
            if (!current) return false;
            emit('action.release', { act: (req && req.act) || current.act });
            current = null;
            log('release', (req && req.act) || '-', null);
            return true;
        }

        function busy() {
            if (!current) return null;
            if (current.until > Date.now()) return { act: current.act, level: current.level };
            current = null;
            return null;
        }

        /* ---------------- 持久化 ---------------- */

        var PREFIX = 'dp:';

        function store(namespace, backend) {
            var ns = namespace ? namespace + '.' : '';
            var be = backend || (typeof localStorage !== 'undefined' ? localStorage : null);
            return {
                get: function (key) {
                    try { return be ? be.getItem(PREFIX + ns + key) : null; } catch (e) { return null; }
                },
                set: function (key, value) {
                    try { if (be) be.setItem(PREFIX + ns + key, value); } catch (e) { /* ignore */ }
                },
                remove: function (key) {
                    try { if (be) be.removeItem(PREFIX + ns + key); } catch (e) { /* ignore */ }
                }
            };
        }

        /* ---------------- 模块装配 ---------------- */

        var modules = [];
        var mountedIds = {};
        var started = false;

        function register(mod) {
            if (!mod || !mod.id || typeof mod.mount !== 'function') {
                throw new Error('PetKernel: 模块必须有 id 与 mount()');
            }
            if (modules.some(function (m) { return m.id === mod.id; })) {
                throw new Error('PetKernel: 模块重复注册 ' + mod.id);
            }
            modules.push(mod);
            return mod;
        }

        function ctxFor(mod) {
            return {
                id: mod.id,
                on: on,
                emit: emit,
                log: logBuf,
                action: requestAction,
                hold: holdAction,
                release: releaseAction,
                busy: busy,
                store: function (ns, be) { return store(ns || mod.id, be); },
                speech: function (act) { emit('speech.act', act); }
            };
        }

        function start() {
            // 允许增量挂载：已经 start 过也能继续装配后来注册的模块
            var ordered = [];
            var seen = {};
            function visit(mod) {
                if (!mod || seen[mod.id]) return;
                seen[mod.id] = true;
                (mod.requires || []).forEach(function (id) {
                    visit(modules.filter(function (m) { return m.id === id; })[0]);
                });
                ordered.push(mod);
            }
            modules.forEach(visit);
            modules = ordered;

            modules.forEach(function (mod) {
                if (mountedIds[mod.id]) return;
                try {
                    mod.mount(ctxFor(mod));
                    mountedIds[mod.id] = true;
                    log('mount', mod.id, null);
                } catch (e) {
                    log('error', 'mount:' + mod.id, e && e.message);
                }
            });
            started = true;
            emit('kernel.ready', { modules: modules.map(function (m) { return m.id; }) });
        }

        function stop() {
            modules.forEach(function (mod) {
                try {
                    if (typeof mod.unmount === 'function') mod.unmount();
                    delete mountedIds[mod.id];
                    log('unmount', mod.id, null);
                } catch (e) {
                    log('error', 'unmount:' + mod.id, e && e.message);
                }
            });
            current = null;
            started = false;
        }

        function list() {
            return modules.map(function (m) { return m.id; });
        }

        var api = {
        on: on,
        emit: emit,
        action: requestAction,
        hold: holdAction,
        release: releaseAction,
        busy: busy,
        register: register,
        start: start,
        stop: stop,
        modules: list,
        log: logList,
        LEVEL: LEVEL,
        level: normalizeLevel,
        defineLevel: defineLevel,
        create: createKernel
    };

        return api;
    }

    export const PetKernel = createKernel();
