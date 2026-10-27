/*!
 * machine 模块 —— 分层状态机（HFSM）
 *
 * 只描述"宠物处于什么基调"，不负责播放。动作池由外部注入，播放器不认识它。
 *
 * 层级用点号表达：'idle.sleepy' 的父状态是 'idle'，
 * 进入子状态会依次触发父状态与子状态的 onEnter；
 * 子状态未声明动作池时继承父状态的池子。
 */


    function createMachine(cfg) {
        var states = cfg.states || {};
        var initial = cfg.initial || Object.keys(states)[0];
        var resolve = cfg.resolve || function () { return initial; };

        var current = null;
        var since = 0;
        var listeners = [];

        function parents(name) {
            var parts = String(name).split('.');
            var out = [];
            for (var i = parts.length; i > 0; i--) out.push(parts.slice(0, i).join('.'));
            out.reverse();              // 从根到叶
            return out;
        }

        function poolOf(name) {
            var chain = parents(name);
            for (var i = chain.length - 1; i >= 0; i--) {
                var s = states[chain[i]];
                if (s && s.pool) return s.pool;
            }
            return [];
        }

        function enter(name) {
            if (!states[name] || name === current) return current;
            var prev = current;
            current = name;
            since = Date.now();
            parents(name).forEach(function (n) {
                var s = states[n];
                if (s && typeof s.onEnter === 'function') {
                    try { s.onEnter(prev, name); } catch (e) { /* ignore */ }
                }
            });
            listeners.forEach(function (fn) {
                try { fn(name, prev); } catch (e) { /* ignore */ }
            });
            return current;
        }

        function desired(ctx) {
            try { return resolve(ctx) || initial; } catch (e) { return initial; }
        }

        return {
            initial: function () { return enter(initial); },
            state: function () { return current; },
            since: function () { return since; },
            set: function (name) { return enter(name); },
            want: function (ctx) { return desired(ctx); },
            actions: function () { return poolOf(current); },
            poolOf: poolOf,
            parents: parents,
            onEnter: function (fn) {
                listeners.push(fn);
                return function () {
                    var i = listeners.indexOf(fn);
                    if (i >= 0) listeners.splice(i, 1);
                };
            },
            /** 按上下文自动迁移到目标状态 */
            sync: function (ctx) { return enter(desired(ctx)); }
        };
    }

    export const PetMachine = { createMachine: createMachine };
