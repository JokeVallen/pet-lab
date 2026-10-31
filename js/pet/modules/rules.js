/*!
 * rules 模块 —— 声明式映射引擎
 *
 * 规则是数据，不是分支：
 *   { id, when(ctx, env), say(ctx, env), act(ctx, env), cooldown }
 *
 * 按数组顺序求值，第一条 when 为真的规则生效（顺序即优先级）。
 * 引擎只管"命中哪条"，说与做由调用方执行。
 */


    function createEngine(rules, opts) {
        var defaultCd = (opts && opts.cooldown != null) ? opts.cooldown : 25;
        var lastFired = {};

        function hit(rule, env, now) {
            var cd = (rule.cooldown == null ? defaultCd : rule.cooldown) * 1000;
            return !(lastFired[rule.id] && now - lastFired[rule.id] < cd);
        }

        function safe(fn, ctx, env, fallback) {
            if (fn == null) return fallback;
            if (typeof fn !== 'function') return fn;
            try { return fn(ctx, env); } catch (e) { return fallback; }
        }

        return {
            /** 返回命中的规则（已求值），未命中返回 null */
            evaluate: function (ctx, env) {
                var now = Date.now();
                for (var i = 0; i < rules.length; i++) {
                    var r = rules[i];
                    if (r.enabled === false) continue;
                    if (!hit(r, env, now)) continue;
                    if (!safe(r.when, ctx, env, false)) continue;
                    lastFired[r.id] = now;
                    return {
                        id: r.id,
                        say: safe(r.say, ctx, env, ''),
                        act: safe(r.act, ctx, env, null)
                    };
                }
                return null;
            },
            reset: function () { lastFired = {}; },
            _lastFired: lastFired
        };
    }


    /**
     * 条件算子表：键名 → { kind, test(ctx, value, env) }
     *
     * 加一个条件只做两件事：往这里加一条，编辑器下拉会自动带上。
     * kind 只影响编辑器怎么取值控件的默认值：number / text / tags / bool
     */
    var WHEN_OPS = {
        page:        { kind: 'text',   label: '页面类型', test: function (ctx, v) { return ctx.page === v; } },
        type:        { kind: 'text',   label: '细分类型', test: function (ctx, v) { return ctx.type === v; } },
        tagsAny:     { kind: 'tags',   label: '标签包含', test: function (ctx, v) { return matchTag(ctx.tags || [], v); } },
        wordsGt:     { kind: 'number', label: '字数 >', test: function (ctx, v) { return ctx.words > v; } },
        wordsLt:     { kind: 'number', label: '字数 <', test: function (ctx, v) { return ctx.words > 0 && ctx.words < v; } },
        commentsEq:  { kind: 'number', label: '评论数 =', test: function (ctx, v) { return ctx.comments === v; } },
        commentsGte: { kind: 'number', label: '评论数 ≥', test: function (ctx, v) { return ctx.comments >= v; } },
        scrollGt:    { kind: 'number', label: '滚动 >', test: function (ctx, v) { return ctx.scroll > v; } },
        scrollGte:   { kind: 'number', label: '滚动 ≥', test: function (ctx, v) { return ctx.scroll >= v; } },
        scrollLt:    { kind: 'number', label: '滚动 <', test: function (ctx, v) { return ctx.scroll < v; } },
        scrollLte:   { kind: 'number', label: '滚动 ≤', test: function (ctx, v) { return ctx.scroll <= v; } },
        lastScrollGt:{ kind: 'number', label: '上次滚动 >', test: function (ctx, v, env) { return (env && env.lastScroll) > v; } },
        dark:        { kind: 'bool',   label: '暗色主题', test: function (ctx, v) { return !!ctx.dark === !!v; } },
        hourGte:     { kind: 'number', label: '小时 ≥', test: function (ctx, v) { return ctx.hour >= v; } },
        hourLt:      { kind: 'number', label: '小时 <', test: function (ctx, v) { return ctx.hour < v; } },
        streakGte:   { kind: 'number', label: '连续天数 ≥', test: function (ctx, v, env) { return ((env && env.streak) || 1) >= v; } }
    };

    /* 旧键名 → 当前键名。stateRules 早期用 hourBelow/hourFrom/scrollFrom/scrollTo，
     * 保留成别名，老配置继续有效，新配置用同一套词汇。 */
    var WHEN_ALIAS = {
        hourBelow: 'hourLt',
        hourFrom: 'hourGte',
        scrollFrom: 'scrollGte',
        scrollTo: 'scrollLte'
    };

    /**
     * 注册新的条件算子。
     * registerWhen('hasCode', { kind: 'bool', test: (ctx) => !!document.querySelector('pre code') })
     * 注册后：配置里能写，编辑器下拉里也能选。
     */
    function registerWhen(name, op) {
        if (!name || typeof name !== 'string') throw new Error('registerWhen: name required');
        if (!op || typeof op.test !== 'function') throw new Error('registerWhen: op.test must be a function');
        WHEN_OPS[name] = { kind: op.kind || 'text', test: op.test };
        return name;
    }

    function getWhenKeys() { return Object.keys(WHEN_OPS); }

    /**
     * 编辑器用：{ key, kind, label, legacy? }
     * legacy = 旧键名的别名，只在编辑老配置时出现。
     */
    function getWhenMeta() {
        var out = Object.keys(WHEN_OPS).map(function (k) {
            return { key: k, kind: WHEN_OPS[k].kind, label: WHEN_OPS[k].label || k };
        });
        Object.keys(WHEN_ALIAS).forEach(function (old) {
            var target = WHEN_ALIAS[old];
            var op = WHEN_OPS[target];
            if (!op) return;
            out.push({
                key: old,
                kind: op.kind,
                label: (op.label || target),
                legacyLabel: '（旧）',
                legacy: true,
                mapsTo: target
            });
        });
        return out;
    }

    /** 把可能带别名的 when 归一化成当前键名 */
    function normalizeWhen(when) {
        if (!when || typeof when !== 'object') return when;
        var out = {};
        Object.keys(when).forEach(function (k) { out[WHEN_ALIAS[k] || k] = when[k]; });
        return out;
    }

    /** 别名是不是同一个算子（编辑器判断「这条旧键要不要换算」用） */
    function isAliasOf(key) { return WHEN_ALIAS[key] || null; }

    function whenKind(name) {
        return (WHEN_OPS[name] && WHEN_OPS[name].kind) || 'number';
    }

    function hasWhen(name) { return Object.prototype.hasOwnProperty.call(WHEN_OPS, name); }

    /**
     * 把声明式条件编译成断言函数。
     * 不认识的键按「不成立」处理——宁可不触发，也不要因为拼错而全命中。
     */
    function compileWhen(spec) {
        if (!spec) return function () { return false; };
        var keys = Object.keys(spec);
        return function (ctx, env) {
            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                var op = WHEN_OPS[k];
                if (!op) return false;                 // 未知键：fail-closed
                var ok;
                try { ok = op.test(ctx, spec[k], env); } catch (e) { return false; }
                if (!ok) return false;
            }
            return true;
        };
    }

    /** 台词模板：支持 {tag} {streak}，数组则随机取一条 */
    function renderSay(spec, ctx, env) {
        var pool = Array.isArray(spec) ? spec : [spec];
        if (!pool.length) return '';
        var raw = pool[Math.floor(Math.random() * pool.length)];
        var tag = (env && env.tagName) || '';
        return String(raw)
            .replace(/\{tag\}/g, tag)
            .replace(/\{streak\}/g, (env && env.streak) || 1);
    }

    function matchTag(tags, list) {
        if (!tags || !list) return false;
        for (var i = 0; i < tags.length; i++) {
            for (var j = 0; j < list.length; j++) {
                if (String(tags[i]).toLowerCase().indexOf(list[j]) >= 0) return true;
            }
        }
        return false;
    }

    export const PetRules = {
        createEngine: createEngine, matchTag: matchTag, compileWhen: compileWhen,
        renderSay: renderSay,
        registerWhen: registerWhen,
        getWhenKeys: getWhenKeys,
        getWhenMeta: getWhenMeta,
        normalizeWhen: normalizeWhen,
        isAliasOf: isAliasOf,
        whenKind: whenKind,
        hasWhen: hasWhen
    };

    /** 兼容旧引用：内置键的快照（动态键请用 getWhenKeys()） */
    export const WHEN_KEYS = getWhenKeys();
