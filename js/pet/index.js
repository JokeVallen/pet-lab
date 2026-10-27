/*!
 * 博客宠物 · 大肥鱼（鲸鱼娘）
 *
 * 播放器与调度逻辑移植自 PC2005-cloud/dsh-pet：
 *   - 选择逻辑  ← src/shared/pickers.ts   (pick / pickWeightedCategory / rollKind / pickCategoryAction)
 *   - 播放器    ← src/client/pet.ts       (switchTo / onReady / setOnce / handleEnded)
 *   - 动画池    ← assets/config.jsonc     (animations.idle / categories / events，按本站素材裁剪)
 *
 * 与仓库实现保持一致的三条约定：
 *   1. 双缓冲：两个 <video> 轮流当前台，换源在后台元素上做，解码完成后才交换；
 *   2. 换源必须拆掉旧元素上的 onended，否则旧片尾会触发新一轮切换（仓库注释里叫"拆雷"）；
 *   3. 待机是循环片，所以需要一个定时器定期重掷，而不是等 ended。
 *
 * 纯前端，不调用任何外部接口、不需要 API Key。
 * 素材署名见 PET_CREDITS.md。
 */

    /* ==================== 条目配置（对应 config.jsonc 条目级字段） ==================== */
    import PetConfig from './config.js';
import { PetKernel } from './core.js';

/* 同页多实例：每个模块实例自己 new 一个内核，事件总线/动作裁决/存储互不共享。
   第二个实例加载的是 ?pet=xxx 这样的不同 URL，模块会被重新求值。 */
var KERNEL = (PetKernel && typeof PetKernel.create === 'function') ? PetKernel.create() : PetKernel;
import { PetAdapter } from './adapter.js';
import { PetPlayer } from './modules/player.js';
import { PetMachine } from './modules/machine.js';
import { PetActions } from './modules/actions.js';
import { PetSpeech } from './modules/speech.js';
import { PetRenderers } from './modules/renderers.js';
import { PetRules } from './modules/rules.js';
import { PetZones } from './modules/zones.js';
import { PetSearch } from './modules/search.js';

var CONFIG = {
        name: '大肥鱼',
        /* 投影：x 正数向右，角色看起来偏左就把它调大 */
        shadow: { offsetX: 0, offsetY: 10, blur: 14, color: 'rgba(33, 72, 145, 0.16)' },
        storageKey: 'deepseek-pet-v4',
        animDir: '/images/pet/anim/',
        image: '/images/pet/anim/poster.webp',   // 首帧占位 / 不支持 WebM 时的静帧
        idleRollMs: [9000, 21000],               // 待机多久后重新掷一次
        idleSleepMs: 150000,                     // 无操作多久后睡着
        fullnessDecayPerDay: 12,
        draggable: true
    };

    /* ---------- 人设：所有台词来自 CONFIG.persona，代码里不再写死角色文案 ----------
     * 必须在 mergeConfig 之后读取：模块顶层 Capture 会拿到还没合并的默认配置。
     */
    function personaSrc() {
        return (CONFIG && CONFIG.persona) || {};
    }

    function persona(key, fallback) {
        var v = personaSrc()[key];
        return (v === undefined || v === null || v === '') ? fallback : v;
    }

    /* 台词可以是单条字符串，也可以是数组（随机取一条） */
    function say_line(key, fallback) {
        var v = persona(key, fallback);
        if (Array.isArray(v)) return v.length ? pick(v) : fallback;
        return v;
    }

    /* {n} 占位符：用于"你来第 N 天"这类带数字的句子 */
    function fillNum(str, n) {
        return String(str == null ? '' : str).replace(/\{n\}/g, String(n));
    }

    function icon(key, fallback) {
        var icons = personaSrc().icons || {};
        return icons[key] || fallback;
    }

    /* 外部配置优先：modules/config.js 里的同名键会覆盖上面的默认值 */
    /* 拷贝一份值：对象和数组都要深拷贝

     * 不能直接把 src 里的对象引用塞进 dst——PetConfig 是模块级共享对象，
     * 两个实例的 CONFIG 会指向同一份 persona，A 改名字 B 跟着变。
     */
    function cloneVal(v) {
        if (Array.isArray(v)) return v.map(cloneVal);
        if (v && typeof v === 'object') {
            var o = {};
            Object.keys(v).forEach(function (k) { o[k] = cloneVal(v[k]); });
            return o;
        }
        return v;
    }

    /* 深合并：后者的值覆盖前者，对象逐层合并 */
    function deepMerge(dst, src) {
        Object.keys(src).forEach(function (k) {
            var v = src[k];
            if (v && typeof v === 'object' && !Array.isArray(v) && dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])) {
                deepMerge(dst[k], v);
            } else {
                dst[k] = cloneVal(v);
            }
        });
        return dst;
    }

    (function mergeConfig() {
        if (!PetConfig) return;
        deepMerge(CONFIG, PetConfig);
        if (PetConfig.animations) ANIMATIONS = PetConfig.animations;
    })();

    /* 同页多只宠物：模块地址带 ?pet=<名字>，用它去 window.PetProfiles 里找覆盖项。
     * 不同 URL 的模块会被浏览器当成两个实例分别求值，所以各有一份闭包状态。
     */
    (function mergeProfile() {
        var name = null;
        try { name = new URL(import.meta.url).searchParams.get('pet'); } catch (e) { /* 老浏览器 */ }
        if (!name) return;
        var reg = (typeof window !== 'undefined' && window.PetProfiles) || null;
        var profile = reg && reg[name];
        if (!profile) {
            console.warn('[pet] 未找到 profile: ' + name);
            return;
        }
        deepMerge(CONFIG, profile);
        if (profile.animations) ANIMATIONS = profile.animations;
        CONFIG.profileName = name;
    })();

    /* ==================== 动画池（对应 animations.*） ==================== */
    var ANIMATIONS = {
        idle: ['idle'],
        clicks: ['click-happy', 'click-shy', 'click-wave'],
        drag: 'drag',
        events: { sleep: 'sleep', eat: 'eat' }
    };

    /* 掷动作的权重属于站点侧策略，读配置；缺省时退化成"只做小动作"。 */
    function rollWeights() {
        var w = (CONFIG.policy && CONFIG.policy.rollWeights) || null;
        if (w && typeof w === 'object') return w;
        return { idle: 10, turn: 0, move: 0 };
    }

    /* ==================== 选择逻辑（移植自 src/shared/pickers.ts） ==================== */
    function pick(pool, exclude) {
        var entries = exclude ? pool.filter(function (n) { return n !== exclude; }) : pool;
        var src = entries.length ? entries : pool;
        return src[Math.floor(Math.random() * src.length)];
    }

    function pickWeightedCategory(categories, facing) {
        var cats = categories.filter(function (c) { return c.actions.length > 0; });
        if (!cats.length) return null;
        var filtered = cats.filter(function (c) { return !(c.noMirror && facing === 'right'); });
        var eligible = filtered.length ? filtered : cats;
        var total = 0;
        eligible.forEach(function (c) { total += c.weight; });
        total = total || 1;
        var t = Math.random() * total;
        for (var i = 0; i < eligible.length; i++) {
            t -= eligible[i].weight;
            if (t <= 0) return eligible[i];
        }
        return eligible[eligible.length - 1];
    }

    function rollKind(roll, w, opts) {
        var turn = (opts && opts.fixed) ? 0 : w.turn;
        var move = (opts && opts.fixed) ? 0 : w.move;
        var topEnd = (w.idle + turn + move) / 100;
        if (roll < w.idle / 100) return 'idle';
        if (roll < (w.idle + turn) / 100) return 'turn';
        if (roll < topEnd) return 'move';
        return 'action';
    }

    function pickCategoryAction(categories, idlePool, facing, current) {
        var cat = pickWeightedCategory(categories, facing);
        if (!cat) return { id: 'FALLBACK', name: pick(idlePool, current) };
        return { id: cat.id, name: pick(cat.actions, current) };
    }

    /* ==================== 小工具 ==================== */
    function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
    function randInt(min, max) { return Math.floor(min + Math.random() * (max - min)); }
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function todayStr() {
        var d = new Date();
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }
    function daysBetween(a, b) {
        var m1 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a || '');
        var m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b || '');
        if (!m1 || !m2) return 0;
        return Math.max(0, Math.round((Date.UTC(+m2[1], +m2[2] - 1, +m2[3]) - Date.UTC(+m1[1], +m1[2] - 1, +m1[3])) / 86400000));
    }

    /* ==================== 素材缓存 ====================
     * 每次互动都要 fetch → blob → 解码 才换源，会有 100~300ms 延迟。
     * 这里把每段动画解码成常驻 blob URL：第一次互动之前就预热好，之后切换是 0 网络。
     * 缓存里的 URL 共享给两个 <video>，所以终生不 revoke（14 段 ~2MB，留着更划算）。
     */
    var clipCache = Object.create(null);

    function preloadClips() {
        var order = [
            'click-happy', 'click-shy', 'click-wave', 'drag', 'eat', 'tail',
            'look', 'doze', 'yawn', 'stretch', 'hum', 'bubbles', 'sleep'
        ];
        var i = 0;
        function next() {
            if (i >= order.length) return;
            var name = order[i++];
            if (clipCache[name]) { setTimeout(next, 40); return; }
            fetch(CONFIG.animDir + name + '.' + (CONFIG.clipExt || 'webm'), { cache: 'force-cache' })
                .then(function (r) { return r.ok ? r.blob() : null; })
                .then(function (b) {
                    if (b) {
                        clipCache[name] = URL.createObjectURL(b);
                        // 缓存一到位就把它装到后台屏，别等固定延时（之前 2.6s 时常还没下完）
                        if (player && (name === 'drag' || name.indexOf('click') === 0)) {
                            try { player.warm(name); } catch (e) { /* ignore */ }
                        }
                    }
                })
                .catch(function () { /* 单段失败不影响其它 */ })
                .then(function () { setTimeout(next, 180); });
        }
        setTimeout(next, 1200);   // 让待机先占带宽
    }

    /* ==================== 播放器（移植自 src/client/pet.ts） ==================== */
    function createPlayer(stage) {
        /* 播放器已搬到 modules/player.js，这里只做依赖注入 */
        if (PetPlayer && PetPlayer.createPlayer) {
            return PetPlayer.createPlayer(stage, {
                clips: clipCache,
                config: CONFIG,
                pick: pick,
                randInt: randInt
            });
        }
        return null;
    }

    /* ==================== 导演（移植自 pickNext / handleEnded） ==================== */
    function createDirector(player, hooks) {
        var facing = 'left';
        var currentAct = '';
        var rollTimer = null;
        var sleeping = false;
        var dropTimer = null;

        function playIdle() {
            currentAct = '';
            player.play((hooks.idleClip && hooks.idleClip()) || ANIMATIONS.idle[0], false);
        }

        function playAct(name, after) {
            currentAct = name;
            player.play(name, true, after);
        }

        function scheduleRoll(delay) {
            clearTimeout(rollTimer);
            clearTimeout(dropTimer);   // 取消上一次拖拽的安全网，否则它会把正在播的动作顶掉
            // 大部分是 9~21s，偶尔 4~7s 接一个小动作：有起伏才不像节拍器
            var wait;
            if (delay != null) wait = delay;
            else if (Math.random() < 0.18) wait = randInt(4000, 7000);
            else wait = randInt(CONFIG.idleRollMs[0], CONFIG.idleRollMs[1]);
            rollTimer = setTimeout(function () {
                if (sleeping || hooks.isPaused()) { scheduleRoll(); return; }
                pickNext();
            }, wait);
        }

        function pickNext() {
            if (sleeping) return;
            var kind = rollKind(Math.random(), rollWeights(), { fixed: true });
            if (kind === 'idle') {
                playIdle();
                scheduleRoll();
                return;
            }
            var pool = hooks.categories ? hooks.categories() : [{ id: 'idle', weight: 1, actions: ANIMATIONS.idle }];
            var act = pickCategoryAction(pool, ANIMATIONS.idle, facing, currentAct);
            playAct(act.name, function () {
                playIdle();
                scheduleRoll();
            });
        }

        function cue(name, after) {
            if (sleeping) return;
            clearTimeout(rollTimer);
            clearTimeout(dropTimer);   // 取消上一次拖拽的安全网，否则它会把正在播的动作顶掉
            playAct(name, function () {
                if (after) after();
                playIdle();
                scheduleRoll();
            });
        }

        function sleep() {
            if (sleeping) return;
            sleeping = true;
            clearTimeout(rollTimer);
            clearTimeout(dropTimer);   // 取消上一次拖拽的安全网，否则它会把正在播的动作顶掉
            var clip = (hooks.sleepyClip && hooks.sleepyClip()) || ANIMATIONS.events.sleep;
            currentAct = clip;
            player.play(clip, false);
        }

        function wake() {
            if (!sleeping) return;
            sleeping = false;
            playIdle();
            scheduleRoll();
        }

        return {
            start: function () { playIdle(); scheduleRoll(); },
            toIdle: function () { clearTimeout(rollTimer); playIdle(); scheduleRoll(); },
            /** 按住：循环"被拎起"，立刻生效 */
            hold: function (name) {
                clearTimeout(rollTimer);
                clearTimeout(dropTimer);   // 取消上一次拖拽的安全网，否则它会把正在播的动作顶掉
                currentAct = name;
                holding = true;
                // 先播升起，播完接悬空循环；松手后不再进循环
                player.play(name, true, function () {
                    if (!holding) return;
                    player.play('drag-hold', false);
                });
                if (hooks.onState) hooks.onState(name);
                // 循环会重复"升起"的动作，所以只播一次
            },
            /** 松手：播一次"落下"，播完回待机 */
            drop: function (name) {
                holding = false;
                clearTimeout(rollTimer);
                clearTimeout(dropTimer);   // 取消上一次拖拽的安全网，否则它会把正在播的动作顶掉
                currentAct = name;
                player.play(name, true, function () { playIdle(); scheduleRoll(); });
                // 安全网：4 秒内一定回待机，任何情况下都不卡在循环里
                clearTimeout(dropTimer);
                dropTimer = setTimeout(function () { playIdle(); scheduleRoll(); }, 3600);
            },
            pickNext: pickNext,
            cue: cue,
            sleep: sleep,
            wake: wake,
            isSleeping: function () { return sleeping; },
            current: function () { return currentAct; }
        };
    }

    /* ==================== 存档 ==================== */
    var STORE = CONFIG.storageKey;
    var root = null;
    var holding = false;   // 是否仍按着（拖拽中）
    var justDragged = 0;      // 拖拽结束时间戳：吞掉随后补发的 click
    var lastScrollSeen = -1;  // 上次评估的滚动比例：判断回顶

    var chatOpen = false;
    var sayTimer = null;
    var sleepTimer = null;
    var actionsTimer = null;   // 左侧按钮的延迟收起
    var player = null;
    var director = null;
    var greeted = false;

    var state = {
        affinity: 0, fullness: 72, hidden: false,
        lastVisit: '', chatLog: [], pos: null, petCount: 0, seen: false
    };

    function load() {
        try {
            var d = JSON.parse(PetAdapter.rawGet(STORE) || 'null');
            if (d) {
                state.affinity = clamp(Number(d.affinity) || 0, 0, 100);
                var f = Number(d.fullness);
                state.fullness = isNaN(f) ? 72 : clamp(f, 0, 100);
                state.hidden = !!d.hidden;
                state.petCount = Number(d.petCount) || 0;
                state.lastVisit = typeof d.lastVisit === 'string' ? d.lastVisit : '';
                state.chatLog = Array.isArray(d.chatLog) ? d.chatLog.slice(-10) : [];
                state.pos = d.pos && typeof d.pos.x === 'number' ? { x: d.pos.x, y: d.pos.y } : null;
            }
        } catch (e) { /* 隐私模式忽略 */ }

        var today = todayStr();
        wasSeenBefore = !!state.seen;   // 本次加载之前是否已经见过
        state.seen = true;
        var gap = daysBetween(state.lastVisit, today);
        state.streak = gap === 1 ? (state.streak || 1) + 1 : (gap === 0 ? (state.streak || 1) : 1);
        if (!state.lastVisit) state.lastVisit = today;
        else {
            var days = daysBetween(state.lastVisit, today);
            if (days > 0) {
                state.fullness = clamp(state.fullness - days * CONFIG.fullnessDecayPerDay, 0, 100);
                state.lastVisit = today;
            }
        }
        save();
    }

    function save() {
        try { PetAdapter.rawSet(STORE, JSON.stringify(state)); } catch (e) { /* ignore */ }
    }

    /* ==================== 表现 ==================== */
    function mood() {
        if (director && director.isSleeping()) return '打盹中';
        if (state.fullness < 20) return '饿扁了';
        if (state.affinity >= 80) return '超喜欢你';
        if (state.affinity >= 45) return '很开心';
        if (state.fullness < 45) return '有点饿';
        return '好奇';
    }

    function updateStats() {
        if (!root) return;
        var a = root.querySelector('[data-dp-meter="affinity"]');
        var f = root.querySelector('[data-dp-meter="fullness"]');
        if (a) a.style.width = clamp(state.affinity, 0, 100) + '%';
        if (f) f.style.width = clamp(state.fullness, 0, 100) + '%';
        var s = root.querySelector('.dp-status');
        if (s) s.textContent = mood();
        root.classList.toggle('is-hungry', state.fullness < 20);
        root.classList.toggle('is-sleep', !!(director && director.isSleeping()));
    }

    function showBubble(text, duration) {
        if (!root || chatOpen) return;
        var bubble = root.querySelector('.dp-bubble');
        if (!bubble) return;
        bubble.textContent = text;
        bubble.classList.add('is-show');
        clearTimeout(sayTimer);
        sayTimer = setTimeout(function () {
            bubble.classList.remove('is-show');
        }, duration || 4200);
    }

    /* 语言通道：所有台词走 speech.act，由 speech 模块决定投递到气泡还是对话框。
       没有内核时退化为直接冒气泡，保证单独也能跑。 */
    function say(text, ttl) {
        if (!text) return;
        if (PetKernel) {
            KERNEL.emit('speech.act', {
                text: text,
                ttl: ttl || 3600,
                channel: 'auto',
                priority: 'context'
            });
            return;
        }
        showBubble(text, ttl);
    }

    var speechMounted = false;

    var actionsMounted = false;

    /* 动作端口：意图 → director。播放器仍在宠物本体里，等搬迁后替换内部实现即可。 */
    function mountActions() {
        if (actionsMounted || root === null || !PetKernel || !PetActions) return;
        if (!director) return;

        KERNEL.register(PetActions.createActionsModule({
            play: function (act) { if (director) director.cue(act); },
            hold: function (act) {
                if (!director || !director.hold) return;
                director.hold(act === 'drag' ? 'drag-up' : act);
            },
            release: function () {
                if (director && director.drop) director.drop('drag-down');
            },
            setState: function (state) {
                if (PetMachine && PetMachine.set) PetMachine.set(state);
            }
        }));
        KERNEL.start();
        actionsMounted = true;
    }

    function mountSpeech() {
        if (speechMounted || root === null || !PetKernel || !PetSpeech) return;
        // 渲染交给 renderers 模块；宠物只提供容器与持久化回调
        var R = PetRenderers || {};
        var logEl = root.querySelector('.dp-chat-log');
        var renderBub = R.bubble ? R.bubble(root) : function (txt, ms) { showBubble(txt, ms); };
        var renderDlg = (R.dialog && logEl)
            ? R.dialog(logEl, { max: CONFIG.chat.maxMessages, onRendered: function (txt) { pushChatLog('pet', txt); } })
            : function (txt) { appendMessage('pet', txt); };
        KERNEL.register(PetSpeech.createSpeechModule({
            renderBubble: renderBub,
            renderDialog: renderDlg,
            isDialogOpen: function () { return chatOpen; },
            dedupeMs: CONFIG.speech.dedupeMs,
            maxQueue: CONFIG.speech.maxQueue
        }));
        KERNEL.start();
        speechMounted = true;
    }


    function burst(emoji, count) {
        if (!root) return;
        for (var i = 0; i < (count || 3); i++) {
            (function (i) {
                var el = document.createElement('span');
                el.className = 'dp-particle';
                el.textContent = emoji;
                el.style.left = (52 + Math.random() * 60) + 'px';
                el.style.animationDelay = (i * 0.07) + 's';
                root.appendChild(el);
                setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1400);
            })(i);
        }
    }

    function resetIdle() {
        if (!CONFIG.idleSleepMs || !director) return;
        clearTimeout(sleepTimer);
        if (director.isSleeping()) {
            director.wake();
            updateStats();
        }
        sleepTimer = setTimeout(function () {
            if (!chatOpen && !document.hidden && director) {
                director.sleep();
                updateStats();
                say(say_line('sleep', '……睡着了。'), 4200);
            }
        }, CONFIG.idleSleepMs);
    }

    function hidePet(hidden) {
        state.hidden = hidden;
        save();
        if (root) root.classList.toggle('is-hidden', hidden);
    }

    /* ==================== 聊天 ==================== */
    var REPLIES = [
        { re: /你好|您好|hi|hello|在吗|嗨/i, list: ['在的！今天也一起写点东西吧。', '嗨～我一直在这儿。'] },
        { re: /知识|卡片|笔记/, list: ['知识库把零散的问题沉淀成卡片了，去 /knowledge/ 翻翻看？', '想记点什么的话，知识库很适合做长期复习。'] },
        { re: /算法|刷题|leetcode|题解/i, list: ['算法库里有间隔复习，先写模板再刷题会快很多：/algorithm/'] },
        { re: /面试|笔试|模拟|求职/, list: ['求职模拟可以随机抽题练表达：/mock/，别只背答案哦。'] },
        { re: /工具|效率/, list: ['实用工具里有些小玩意，写博客的时候挺顺手的：/tools/'] },
        { re: /游戏|摸鱼|玩/, list: ['个人游戏区有几只小游戏，写累了可以去摸鱼：/games/'] },
        { re: /题库|unity|c#|csharp/i, list: ['Unity 题库按知识点整理过，可以按标签挑着看：/questions/'] },
        { re: /博客|文章|首页|归档/, list: ['首页就是归档，慢慢翻吧，都是些记录和思考。'] },
        { re: /饿|吃|鱼|投喂|喂/, list: ['想吃白米饭……点一下 🍚 就能喂我。', '肚子在叫了，有米饭吗？'] },
        { re: /累|难过|焦虑|压力|烦/, list: ['先休息五分钟吧。写不完的代码不会跑掉，但你会的。', '要不要先站起来走两步？我在这儿等你。'] },
        { re: /谢谢|喜欢|可爱|爱你|棒/, list: ['嘿嘿，被夸到了。好感度 +1！', '被你这么说，尾巴都翘起来了。'] },
        { re: /你是谁|你叫什么|什么鲸鱼|deepseek/i, list: ['我是博客里的鲸鱼娘大肥鱼，不是官方产品哦，只是一只住在网页角落里的小鲸鱼。'] },
        { re: /晚安|睡觉|困/, list: ['晚安，早点休息。我会在角落里打盹。'] },
        { re: /米饭|饭|饿|吃/, list: ['白米饭才是正经饭，点 🍚 喂我。', '一碗就够了……好吧，两碗。'] },
        { re: /拖|抓|拎/, list: ['别拎我尾巴！', '被抓起来的时候我会缩一下，正常的。'] },
        { re: /摸头|脑袋|头/, list: ['摸头可以，戳就不行。', '头顶的发饰是限量款。'] },
        { re: /暗色|夜间|晚上|开灯|主题/, list: ['开暗色我就当是晚上了。', '白天模式我会精神一点。'] },
        { re: /无聊|没事|陪你/, list: ['那就陪我看会儿代码吧。', '无聊的话，去算法库随便点一道？'] },
        { re: /bug|报错|崩|错误/i, list: ['报错总能解决的，先看第一行日志。', '把复现步骤写下来，问题就小一半。'] },
        { re: /加油|努力|坚持/, list: ['一起加油，慢慢来。', '每天一点就够，别把自己逼太紧。'] },
        { re: /早|早安/, list: ['早安！今天想先解决哪一件事？'] },
        { re: /厉害|难|不会|学不动/, list: ['不会才正常，会了就不用学了。挑最小的一步先做。'] }
    ];

    /* ==================== 全站索引检索 ====================
     * /pet-index.json 由构建期的 scripts/pet-index.js 生成（文章 + 知识卡片 + 页面）。
     * 懒加载：只有第一次问"有没有关于 X 的"时才拉，首屏不碰它。
     */

    /* 先看能不能用"当前页面的信息"来回答，比固定句库更有针对性 */
    function siteAwareReply(t) {
        try {
            var c = siteContext();
            if (/能做什么|会什么|功能|你能干|会干|帮我做|有什么用/.test(t)) {
                return '能陪你读文章、记住你来了几天，也会被戳、被拖、被喂。问路也行：算法库 /algorithm/、题库 /questions/、工具 /tools/。';
            }
            if (/这篇|讲的什么|说什么|内容/.test(t) && c.page === 'post') {
                var mins = c.words > 0 ? '，大概 ' + Math.max(1, Math.round(c.words / 400)) + ' 分钟能读完' : '';
                return '这篇属于「' + (c.tags[0] || '没打标签') + '」' + mins + '。正文我也看不懂，你自己读吧。';
            }
            if (/几点|现在时间|几号|星期几/.test(t)) {
                var d = new Date();
                var mm = d.getMinutes() < 10 ? '0' + d.getMinutes() : d.getMinutes();
                return '现在 ' + d.getHours() + ' 点 ' + mm + ' 分。' + (d.getHours() >= 23 ? '该睡了。' : '');
            }
            if (/几个标签|多少标签|什么标签/.test(t)) {
                return c.tags.length
                    ? '这页有 ' + c.tags.length + ' 个标签：' + c.tags.slice(0, 3).join('、') + '。'
                    : '这页没标签，标签总览在 /tags/。';
            }
            if (/多久|来了几天|第几天/.test(t) && state.streak) {
                return '这是你连续来的第 ' + state.streak + ' 天，我记着呢。';
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    /* 站内检索：索引由构建期生成，模块负责加载与打分 */
    var SEARCH = (PetSearch ? PetSearch.createSearch({
        url: '/pet-index.json',
        say: function (txt) { try { appendMessage('pet', txt); } catch (e) { /* ignore */ } }
    }) : null);

    function petReply(text) {
        var t = (text || '').trim();
        if (!t) return '你想说什么呀？';
        var ctxAns = siteAwareReply(t);
        if (ctxAns) return ctxAns;

        if (SEARCH && SEARCH.matches(t)) {
            var idxAns = SEARCH.answer(t);
            if (idxAns) return idxAns;
        }
        for (var i = 0; i < REPLIES.length; i++) {
            if (REPLIES[i].re.test(t)) {
                var ans = pick(REPLIES[i].list);
                return typeof ans === 'function' ? ans() : ans;
            }
        }
        return pick([
            '这个问题值得写一张知识卡片。',
            '要不要去求职模拟抽一组题？',
            '今天也别忘了给算法库安排一次复习。',
            '慢慢来，先把一个问题讲清楚。',
            '我在这里，你写你的，我不吵你。',
            '唔……这个我还没学会，等我长大一点再回答你。'
        ]);
    }

    /* 把回复里的站内路径变成可点的链接；其余文字原样输出 */
    function fillText(el, text) {
        var str = String(text || '');
        var re = /(\/[A-Za-z0-9_\-.~#/?=&%+]*[A-Za-z0-9_\-])/g;
        var last = 0;
        var m;
        while ((m = re.exec(str))) {
            if (m.index > last) el.appendChild(document.createTextNode(str.slice(last, m.index)));
            var a = document.createElement('a');
            a.href = m[1];
            a.className = 'dp-link';
            a.textContent = m[1];
            el.appendChild(a);
            last = m.index + m[1].length;
        }
        if (last < str.length) el.appendChild(document.createTextNode(str.slice(last)));
    }

    function appendMessage(role, text) {
        if (!root) return;
        var log = root.querySelector('.dp-chat-log');
        if (!log) return;
        var msg = document.createElement('div');
        msg.className = 'dp-msg ' + (role === 'user' ? 'is-user' : 'is-pet');
        fillText(msg, text);
        log.appendChild(msg);
        while (log.children.length > 10) log.removeChild(log.firstChild);
        log.scrollTop = log.scrollHeight;
        state.chatLog.push({ role: role, text: text });
        state.chatLog = state.chatLog.slice(-CONFIG.chat.maxMessages);
        save();
    }

    /* 只做持久化，渲染归 renderers 模块 */
    function pushChatLog(role, text) {
        try {
            state.chatLog.push({ role: role, text: text });
            state.chatLog = state.chatLog.slice(-CONFIG.chat.maxMessages);
            save();
        } catch (e) { /* ignore */ }
    }

    function renderChatLog() {
        if (!root) return;
        var log = root.querySelector('.dp-chat-log');
        if (!log) return;
        log.innerHTML = '';
        var list = state.chatLog.length ? state.chatLog : [{
            role: 'pet',
            text: persona('about', '点我、拖我，或者随便和我聊聊～')
        }];
        list.forEach(function (m) {
            var msg = document.createElement('div');
            msg.className = 'dp-msg ' + (m.role === 'user' ? 'is-user' : 'is-pet');
            fillText(msg, m.text);
            log.appendChild(msg);
        });
        log.scrollTop = log.scrollHeight;
    }

    function sendChat() {
        if (!root) return;
        var input = root.querySelector('.dp-chat-input');
        if (!input) return;
        var text = input.value.trim();
        if (!text) return;
        input.value = '';
        appendMessage('user', text);
        resetIdle();
        if (director) director.cue('hum');       // "在想"的动作
        setTimeout(function () {
            appendMessage('pet', petReply(text));
            updateStats();
            if (director && Math.random() < 0.6) director.cue(pick(ANIMATIONS.clicks));
        }, 620);
    }

    function setChatOpen(open) {
        if (!root) return;
        chatOpen = open;
        root.classList.toggle('is-chatting', open);
        var chat = root.querySelector('.dp-chat');
        if (chat) chat.classList.toggle('is-open', open);
        if (open) {
            var bubble = root.querySelector('.dp-bubble');
            if (bubble) bubble.classList.remove('is-show');
            renderChatLog();
            var input = root.querySelector('.dp-chat-input');
            if (input) setTimeout(function () { input.focus(); }, 80);
        }
    }

    /* 左侧动作按钮：鼠标穿过角色与按钮之间的缝隙时不能立刻消失，
     * 否则"还没点中就没了"。宽限时长与淡入淡出都在 config 的 click 组里。
     */
    function bindActionsHover() {
        if (!root) return;
        var ui = CONFIG.ui || {};
        var delay = ui.actionHideDelayMs;
        if (delay == null) delay = 320;

        root.addEventListener('pointerenter', function () {
            clearTimeout(actionsTimer);
            root.classList.add('is-actions');
        });
        root.addEventListener('pointerleave', function () {
            clearTimeout(actionsTimer);
            actionsTimer = setTimeout(function () {
                if (!root.classList.contains('is-chatting')) root.classList.remove('is-actions');
            }, delay);
        });
    }

    /* ==================== 互动 ==================== */
    function greet() {
        // 同一个会话里只打招呼一次：整页跳转时会重新执行 build()，否则每次都被当成"第一次见"
        try {
            if (PetAdapter.sessionGet('dp-greeted')) return;
            PetAdapter.sessionSet('dp-greeted', '1');
        } catch (e) { /* 隐私模式下忽略 */ }
        if (greeted) return;
        greeted = true;
        var hour = new Date().getHours();
        var line;
        var greetSlot = hour < 6 ? 'late' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
        var greetLines = (personaSrc().greet || {})[greetSlot] || [];
        line = greetLines.length ? pick(greetLines) : '你好呀。';
        var special = null;
        try { special = PetAdapter.holiday && PetAdapter.holiday(); } catch (e) { /* ignore */ }
        if (special && special.line) {
            line = special.line;
            if (director && special.act) setTimeout(function () { director.cue(special.act); }, 1600);
        } else if ((state.streak || 1) === 1) {
            line = wasSeenBefore ? persona('again', '又见面了。') : persona('firstMeet', '第一次见？');
        } else if ((state.streak || 1) >= 7) {
            line = fillNum(persona('streak7', '你来第 {n} 天啦。'), state.streak);
        } else if ((state.streak || 1) >= 3) {
            line = fillNum(persona('streak3', '又见面了，第 {n} 天。'), state.streak);
        }
        setTimeout(function () { say(line, 5200); }, 1200);
    }

    /* 按点击位置分区：脑袋 / 身体 / 尾巴，反应不同 */
    /* ==================== 点击分区（几何） ====================
     * 归一化坐标，与角色图尺寸无关；换图只改这里。
     * 子分区先命中，父分区兜底。
     */
    var ZONES = (PetConfig && PetConfig.zones && PetConfig.zones.length) ? PetConfig.zones : ZONES_DEFAULT;
    var ZONES_DEFAULT = [
        { id: 'head', yMin: 0.00, yMax: 0.42 },
        { id: 'head.crown', yMin: 0.00, yMax: 0.14, parent: 'head' },
        { id: 'head.cheek', yMin: 0.14, yMax: 0.30, parent: 'head' },
        { id: 'head.face', yMin: 0.30, yMax: 0.42, parent: 'head' },
        { id: 'body', yMin: 0.42, yMax: 0.86 },
        { id: 'body.fin', yMin: 0.55, yMax: 0.74, xMin: 0.00, xMax: 0.35, parent: 'body' },
        { id: 'body.belly', yMin: 0.60, yMax: 0.86, xMin: 0.35, xMax: 0.70, parent: 'body' },
        { id: 'tail', yMin: 0.86, yMax: 1.00 }
    ];

    /* ==================== 分区 → 反应（语义） ====================
     * 没写的分区自动回落父级；全都没有就落回 body。
     * say 可写成数组，元素可为 { t: '台词', w: 权重 }。
     */
    var ZONE_MAP_DEFAULT = {
        'head': { act: 'click-shy', say: ['别戳脑袋啦。', '脑袋不能乱摸……'] },
        'head.crown': { act: 'click-wave', say: ['头上有东西吗？'] },
        'head.cheek': { act: 'click-shy', say: [{ t: '痒。', w: 2 }, { t: '别捏脸。' }] },
        'head.face': { act: 'click-shy' },
        'body': { act: 'click-happy', say: ['干嘛呀。'] },
        'body.fin': { act: 'spin', say: ['鳍不能拽。'] },
        'body.belly': { act: 'click-happy', say: [{ t: '肚子软软的。', w: 2 }, { t: '别戳肚子啦。' }] },
        'tail': { act: 'tail', say: [{ t: '尾巴会痒的。', w: 2 }, { t: '甩你一脸水。' }] }
    };

    var ZONE_MAP = (PetConfig && PetConfig.zoneReactions) ? PetConfig.zoneReactions : ZONE_MAP_DEFAULT;

    var ZONES_ENGINE = (PetZones ? PetZones.createZones({
        zones: ZONES, map: ZONE_MAP, fallback: 'body'
    }) : null);

    var zoneDebug = /(?:^|[?&])pet-zone=1/.test(location.search);

    /* 调试层：把分区边界画在角色上，顺带显示当前指针所在分区 */
    function mountZoneDebug() {
        if (!zoneDebug || !root || !ZONES_ENGINE) return;
        var ch = root.querySelector('.dp-character');
        if (!ch || ch.querySelector('.dp-zone-debug')) return;
        var layer = document.createElement('div');
        layer.className = 'dp-zone-debug';
        ZONES.forEach(function (z) {
            var band = document.createElement('div');
            band.className = 'dp-zone-band';
            band.dataset.zone = z.id;
            band.style.top = (z.yMin * 100) + '%';
            band.style.height = ((z.yMax - z.yMin) * 100) + '%';
            if (z.xMin != null) { band.style.left = (z.xMin * 100) + '%'; band.style.width = ((z.xMax - z.xMin) * 100) + '%'; }
            band.title = z.id;
            layer.appendChild(band);
        });
        ch.appendChild(layer);
        ch.addEventListener('pointermove', function (e) {
            var r = ch.getBoundingClientRect();
            var y = (e.clientY - r.top) / r.height;
            var x = (e.clientX - r.left) / r.width;
            var id = ZONES_ENGINE.hit(y, x) || '-';
            root.setAttribute('data-zone', id);
        });
    }

    /* 把 CONFIG.shadow 写进 CSS 变量；改这里比改样式表更直观 */
    function applyShadow() {
        try {
            if (!root || !CONFIG.shadow) return;
            var s = CONFIG.shadow;
            var sx = (s.offsetX != null ? s.offsetX : (s.x || 0));
            root.style.setProperty('--dp-shadow-x', sx + 'px');
            var sy = (s.offsetY != null ? s.offsetY : (s.y == null ? 10 : s.y));
            root.style.setProperty('--dp-shadow-y', sy + 'px');
            root.style.setProperty('--dp-shadow-blur', (s.blur == null ? 14 : s.blur) + 'px');
            if (s.color) root.style.setProperty('--dp-shadow-color', s.color);
        } catch (e) { /* ignore */ }
    }

    function zoneAt(el, clientY, clientX) {
        try {
            var r = el.getBoundingClientRect();
            if (!r.height) return 'body';
            var y = (clientY - r.top) / r.height;
            var x = clientX == null ? 0.5 : (clientX - r.left) / r.width;
            if (ZONES_ENGINE) {
                var id = ZONES_ENGINE.hit(Math.min(0.999, Math.max(0, y)), x);
                if (id) return id;
            }
        } catch (e) { /* ignore */ }
        return 'body';
    }

    /* 点击反应：分区 → 映射 → 动作 + 台词。台词在 ZONE_MAP，改词不用动这里 */
    function doPet(zone) {
        if (!director) return;
        var hit = (PetZones && ZONES_ENGINE) ? ZONES_ENGINE.resolve(zone) : null;
        var rule = hit && hit.rule ? hit.rule : null;
        var act = (rule && rule.act) || 'click-happy';
        director.cue(act);
        var line = rule ? ZONES_ENGINE.pickSay(rule) : null;
        if (line) say(line, 3400);
        if (/^head/.test(zone)) burst('\u{1F497}', 3);
        else if (zone === 'tail') burst('\u{1F4A7}', 3);
        try { state.petCount = (state.petCount || 0) + 1; save(); } catch (e) { /* ignore */ }
    }

    function doFeed() {
        resetIdle();
        burst('🍚', 3);
        if (director) director.cue(ANIMATIONS.events.eat);
        say(say_line('feed', '谢谢！'), 3600);
    }

    /* ==================== 状态 ====================
     * 宠物只提供"有哪些状态、每个状态播什么"；进入哪个状态由站点层决定。
     * 词汇表在 config/states，判断在 PetAdapter.pickState。
     */
    var STATES = (PetConfig && PetConfig.states && Object.keys(PetConfig.states).length)
        ? PetConfig.states
        : { idle: { clip: 'idle', pool: ['look'] } };

    function stateId() {
        var ctx = null;
        try { ctx = siteContext(); } catch (e) { /* ignore */ }
        try { return (PetAdapter && PetAdapter.pickState && PetAdapter.pickState(ctx)) || 'idle'; }
        catch (e) { return 'idle'; }
    }

    function stateClips(id) {
        var s = STATES[id] || STATES.idle;
        var pool = (s && s.pool) || [];
        return pool.length ? pool : (STATES.idle.pool || ['look']);
    }

    function idleClip() {
        var s = STATES.idle;
        return (s && s.clip) || 'idle';
    }

    function sleepyClip() {
        var s = STATES.sleepy || STATES.idle;
        return (s && s.clip) || 'sleep';
    }

    /* ==================== 昼夜 ==================== */
    function isDark() {
        return PetAdapter.isDark();
    }

    function categoriesForNow() {
        // 状态由站点层挑，宠物只把该状态的片段池交回去
        var id = stateId();
        return [{ id: id, weight: 1, actions: stateClips(id) }];
    }

    function watchTheme() {
        var last = isDark();
        function onChange() {
            var now = isDark();
            if (now === last) return;
            last = now;
            updateStats();
            if (director && !chatOpen) {
                director.cue(now ? 'yawn' : 'stretch');
                say(now ? pick(['天黑了呢，我把音量调小一点。', '夜里安静，适合慢慢写。', '开暗色了……那我也有点困了。'])
                        : pick(['开灯啦，精神一点！', '白天模式，冲！', '亮起来就清醒了。']), 3600);
            }
        }
        try {
            new MutationObserver(onChange).observe(document.documentElement, {
                attributes: true, attributeFilter: ['data-theme', 'class', 'data-color']
            });
            new MutationObserver(onChange).observe(document.body, {
                attributes: true, attributeFilter: ['class']
            });
        } catch (e) { /* 老浏览器忽略 */ }
    }

    /* ==================== 站点上下文 ====================
     * 只读当前页面已有的信息，不新增网络请求、不新增滚动监听。
     * 每个信号都必须在 30s tick 或 pjax 时"按需读一次"，不常驻。
     */
    var ctxDwellFrom = 0;
    var lastSaid = '';
    var wasSeenBefore = false;

    /* 同句不连说；调试期不做概率过滤，先保证"一定能看见" */
    function sayMaybe(text, ms) {
        if (!text || !root || chatOpen) return false;
        if (text === lastSaid) return false;
        lastSaid = text;
        say(text, ms);
        return true;
    }

    function actMaybe(name) {
        if (!director || !name) return false;
        director.cue(name);
        return true;
    }

    var lastCtxAt = 0;

    function siteContext() {
        var type = PetAdapter.pageType();
        return {
            page: type === 'post' ? 'post' : (type === 'home' ? 'home' : 'other'),
            type: type,
            tags: PetAdapter.tags(),
            words: PetAdapter.wordCount(),
            comments: PetAdapter.commentCount(),
            scroll: PetAdapter.scrollRatio(),
            dark: PetAdapter.isDark(),
            hour: new Date().getHours()
        };
    }

    function matchTag(tags, list) {
        for (var i = 0; i < tags.length; i++) {
            for (var j = 0; j < list.length; j++) {
                if (tags[i].toLowerCase().indexOf(list[j]) >= 0) return true;
            }
        }
        return false;
    }

    /* 命中的第一条规则当场说话 + 做个动作；每分钟最多一次，避免变吵 */
    /* ==================== 上下文规则（数据） ====================
     * 顺序即优先级；when/say/act 可以是值，也可以是 (ctx, env) => 值。
     * 站点相关的判断全部通过 PetAdapter 提供的字段进行，宠物不认识 DOM。
     */
    /* 规则表属于站点层：见 adapter.js 的 CTX_RULES */
    var CTX_RULES = (PetAdapter && PetAdapter.rules) || [];

    var ctxEngine = (PetRules ? PetRules.createEngine(CTX_RULES, { cooldown: CONFIG.rules.defaultCooldown }) : null);

    function runContext() {
        if (!director || chatOpen || document.hidden || root.classList.contains('is-hidden') || root.classList.contains('is-dragging')) return;
        if (!ctxEngine) return;

        var c;
        try { c = siteContext(); } catch (e) { return; }
        if (!c) return;

        var env = { streak: state.streak, lastScroll: lastScrollSeen, adapter: PetAdapter };
        lastScrollSeen = c.scroll;

        var hit = ctxEngine.evaluate(c, env);
        if (!hit || !hit.say) return;
        say(hit.say, 4200);
        if (hit.act) director.cue(hit.act);
    }

    /* 滚动只在停下来 700ms 后算一次，passive，不阻塞滚动 */
    function watchSelection() {
        if (watchSelection.done) return;
        watchSelection.done = true;
        var lastAt = 0;
        document.addEventListener('selectionchange', function () {
            var now = Date.now();
            if (now - lastAt < 15000) return;
            if (!director || chatOpen || document.hidden || root.classList.contains('is-dragging')) return;
            try {
                var sel = window.getSelection && window.getSelection();
                var text = sel ? String(sel).trim() : '';
                if (text.length < 8) return;
                lastAt = now;
                say('抄走也没关系，反正我也不会写回去。', 3200);
                director.cue('look');
            } catch (e) { /* ignore */ }
        }, { passive: true });
    }

    function watchScroll() {
        if (watchScroll.done) return;
        watchScroll.done = true;

        var timer = null;
        var wasBottom = false;

        function ratio() {
            return PetAdapter.scrollRatio();
        }

        window.addEventListener('scroll', function () {
            clearTimeout(timer);
            timer = setTimeout(function () {
                try {
                    if (!director || chatOpen || document.hidden || root.classList.contains('is-dragging')) return;
                    var r = ratio();

                    if (r > 0.92) {
                        if (!wasBottom) {
                            wasBottom = true;
                            say('读到底了，辛苦了。', 3600);
                            director.cue('look');
                        }
                        return;
                    }

                    if (wasBottom && r < 0.12) {
                        wasBottom = false;
                        say(pick(['回到开头了，要再读一遍吗？', '又回到上面了。']), 3200);
                        director.cue('stretch');
                    }
                } catch (e) {
                    console.warn('[pet] scroll handler', e);
                }
            }, 450);
        }, { passive: true });
    }

    /* 标签 / 分类页：换页后直接说一句，不经过上下文链 */
    function tagPageLine() {
        try {
            if (!director || chatOpen || document.hidden) return;
            var name = PetAdapter.tagFromPath();
            if (!name) return;
            say('在翻「' + name + '」相关的内容呀。', 3600);
            director.cue('hum');
        } catch (e) { /* ignore */ }
    }

    /* ==================== 拖动 ==================== */
    function applyPos() {
        if (!root || !state.pos) return;
        var w = root.offsetWidth || 200;
        var h = root.offsetHeight || 180;
        var x = clamp(state.pos.x, 4, Math.max(4, window.innerWidth - w - 4));
        var y = clamp(state.pos.y, 4, Math.max(4, window.innerHeight - h - 4));
        root.style.left = x + 'px';
        root.style.top = y + 'px';
        root.style.right = 'auto';
        root.style.bottom = 'auto';
    }

    function initDrag() {
        if (!CONFIG.draggable || !root) return;
        var ch = root.querySelector('.dp-character');
        if (!ch) return;
        var dragging = false, moved = false;
        var start = { x: 0, y: 0, left: 0, top: 0 };

        ch.addEventListener('pointerdown', function (e) {
            if (e.button != null && e.button !== 0) return;
            // 一按下就换成"被抓起"的姿态；素材已缓存，切源基本无等待
            if (director) director.hold('drag-up');
            var rect = root.getBoundingClientRect();
            dragging = true;
            moved = false;
            start = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top };
            root.classList.add('is-dragging');
            if (ch.setPointerCapture) { try { ch.setPointerCapture(e.pointerId); } catch (err) {} }
        });

        ch.addEventListener('pointermove', function (e) {
            if (!dragging) return;
            var dx = e.clientX - start.x, dy = e.clientY - start.y;
            if (!moved && Math.abs(dx) + Math.abs(dy) < CONFIG.drag.thresholdPx) return;
            moved = true;
            root.style.left = (start.left + dx) + 'px';
            root.style.top = (start.top + dy) + 'px';
            root.style.right = 'auto';
            root.style.bottom = 'auto';
        });

        function end(e) {
            if (!dragging) return;
            dragging = false;
            root.classList.remove('is-dragging');
            if (moved) {
                state.pos = { x: parseFloat(root.style.left) || 0, y: parseFloat(root.style.top) || 0 };
                save();
                applyPos();
            }
        }
        ch.addEventListener('pointerup', function (e) {
            var wasMoved = moved;
            var y = e.clientY;
            end(e);
            if (wasMoved) {
                justDragged = Date.now();   // 拖拽结束：吞掉浏览器补发的 click
                if (director) director.drop('drag-down');   // 松手播落下，播完自动回待机
            } else {
                justDragged = 0;
                doPet(zoneAt(ch, y));       // 真正的点击在这里判定
            }
        });
        ch.addEventListener('pointercancel', end);

        // 兜底：指针在角色外松开、切标签页、窗口失焦时，pointerup 不一定回到角色身上。
        // 少了这条，拖拽状态会卡在"悬空"，只能等那段 7 秒动画自己播完。
        window.addEventListener('pointerup', function () {
            if (!dragging) return;
            var wasMoved = moved;
            end();
            if (wasMoved && director) director.drop('drag-down');
        }, { passive: true });
        window.addEventListener('blur', function () {
            if (!dragging) return;
            end();
            if (director) director.drop('drag-down');
        });
        ch.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doPet('body'); }
        });
        window.addEventListener('resize', applyPos);
        window.addEventListener('orientationchange', applyPos);
    }

    /* 把配置里的尺寸和配色写到 CSS 变量上，样式表只负责默认值 */
    function applyTheme() {
        if (!root) return;
        var size = CONFIG.size || {};
        if (size.width) root.style.setProperty('--dp-w', size.width + 'px');
        if (size.height) root.style.setProperty('--dp-h', size.height + 'px');
        var ui = CONFIG.ui || {};
        if (ui.actionFadeMs) root.style.setProperty('--dp-actions-fade', ui.actionFadeMs + 'ms');
        var off = CONFIG.offset || {};
        if (off.x) root.style.setProperty('--dp-ox', off.x + 'px');
        if (off.y) root.style.setProperty('--dp-oy', off.y + 'px');
        var accent = CONFIG.accent || {};
        if (accent.primary) root.style.setProperty('--dp-primary', accent.primary);
        if (accent.primary2) root.style.setProperty('--dp-primary-2', accent.primary2);
        if (accent.cyan) root.style.setProperty('--dp-cyan', accent.cyan);
    }

    /* ==================== 构建 ==================== */
    function build() {
        var hostId = CONFIG.hostId || 'deepseek-pet';
        if (document.getElementById(hostId)) return;
        root = document.createElement('div');
        root.id = hostId;
        root.className = 'dp-root';
        applyTheme();
        var petName = persona('name', CONFIG.name || '宠物');
        root.innerHTML = [
            '<div class="dp-bubble" role="status" aria-live="polite"></div>',
            '<div class="dp-chat" role="dialog" aria-label="和' + petName + '聊天">',
            '  <div class="dp-chat-head"><span>' + petName + '</span><button type="button" class="dp-chat-close" data-dp-action="chat" aria-label="关闭对话">×</button></div>',
            '  <div class="dp-chat-log"></div>',
            '  <form class="dp-chat-form">',
            '    <input type="text" class="dp-chat-input" maxlength="60" placeholder="和' + petName + '说点什么…" aria-label="输入消息">',
            '    <button type="submit" class="dp-chat-send">发送</button>',
            '  </form>',
            '  <p class="dp-credit">' + persona('credit', '动画素材 <a href="https://github.com/PC2005-cloud/dsh-pet" target="_blank" rel="noopener nofollow">dsh-pet</a> · 角色 <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh" target="_blank" rel="noopener nofollow">CC BY-NC-SA 4.0</a>') + '</p>',
            '</div>',
            '<div class="dp-actions">',
            '  <button type="button" class="dp-action" data-dp-action="feed" title="投喂" aria-label="投喂">' + icon('feed', '🍚') + '</button>',
            '  <button type="button" class="dp-action" data-dp-action="chat" title="聊天" aria-label="聊天">💬</button>',
            '  <button type="button" class="dp-action" data-dp-action="hide" title="隐藏" aria-label="隐藏' + petName + '">×</button>',
            '</div>',
            '<div class="dp-character" data-dp-action="pet" role="button" tabindex="0" aria-label="摸摸' + petName + '">',
            '  <div class="dp-shadow"></div>',
            '  <div class="dp-body">',
            '    <div class="dp-stage"><img class="dp-art" src="' + CONFIG.image + '" alt="' + persona('alt', petName) + '" draggable="false"></div>',
            '  </div>',
            '</div>',
            '<div class="dp-restore" data-dp-action="restore" title="召回' + petName + '" role="button" tabindex="0">' + icon('restore', '🐳') + '</div>'
        ].join('');
        document.body.appendChild(root);

        bindActionsHover();
        root.classList.toggle('is-hidden', state.hidden);
        applyPos();
        updateStats();
        renderChatLog();

        root.addEventListener('click', function (e) {
            var el = e.target.closest ? e.target.closest('[data-dp-action]') : null;
            if (!el || !root.contains(el)) return;
            var action = el.getAttribute('data-dp-action');
            if (action === 'restore') { hidePet(false); say('我回来啦。', 2600); return; }
            if (action === 'hide') { hidePet(true); return; }
            if (action === 'chat') { setChatOpen(!chatOpen); return; }
            if (action === 'feed') { doFeed(); return; }
            if (action === 'pet') {
                return;   // 点击统一由 pointerup 判定，这里不处理（否则放下会被当成摸头）
            }
        });

        root.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') setChatOpen(false);
        });

        var form = root.querySelector('.dp-chat-form');
        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                sendChat();
            });
        }

        initDrag();
        initPlayer();
        var tick = 0;
        setInterval(function () {
            if (state.hidden || document.hidden) return;
            tick += 1;
            runContext();   // 每 2 分钟评估一次，复用同一个定时器
        }, 30000);

        document.addEventListener('visibilitychange', function () {
            if (!player) return;
            if (document.hidden) {
                setChatOpen(false);
                player.pause();
            } else {
                player.resume();
                resetIdle();
            }
        });

        watchTheme();
        watchScroll();
        watchSelection();

        // 首次挂载也评估一次：主题若是整页跳转（不走 pjax），换页后走不到 pjax 分支
        setTimeout(function () {
            try { tagPageLine(); } catch (e) { /* ignore */ }
            try { runContext(); } catch (e) { /* ignore */ }
        }, 700);

        // 鼠标靠近：偶尔抬头看一眼（有冷却，别烦人）
        var lastGlance = 0;

        /* 首帧闸：换上前台后要等视频真的开始出帧，静帧才让位。
           否则用户会看到"抓起来一动不动"——素材首帧与待机几乎一样，
           视频还没解码完时看起来就像没反应。 */
        var frameTimer = null;
        function gateStatic() {
            var st = root && root.querySelector('.dp-stage');
            if (!st || !player || !player.ready) return;
            if (frameTimer) { clearTimeout(frameTimer); frameTimer = null; }

            function check() {
                frameTimer = null;
                if (!player || !player.ready()) {
                    st.classList.add('is-static');
                    frameTimer = setTimeout(check, 60);
                    return;
                }
                st.classList.remove('is-static');
            }

            if (!player.ready()) st.classList.add('is-static');
            check();
        }

        if (player) {
            var rawPlay = player.play;
            player.play = function () {
                var r = rawPlay.apply(player, arguments);
                gateStatic();
                return r;
            };
        }

        resetIdle();
        greet();
    }

    function initPlayer() {
        if (!root) return;
        var stage = root.querySelector('.dp-stage');
        if (!stage) return;

        var canWebm = false;
        try {
            canWebm = !!(document.createElement('video').canPlayType &&
                document.createElement('video').canPlayType('video/webm; codecs="vp9"'));
        } catch (e) { canWebm = false; }

        // 只有浏览器真的放不了透明 WebM 才退回静帧。
        // 注意：这里**不**看 prefers-reduced-motion —— 宠物本体就是这段动画，
        // 按"减少动效"关掉它等于整只宠物死了。系统级的动效偏好只作用于
        // 页面装饰（浮动、粒子），见 CSS 里的同名媒体查询。
        if (!canWebm) {
            stage.classList.add('is-static');
            return;
        }

        player = createPlayer(stage);
        director = createDirector(player, {
            isPaused: function () { return chatOpen || document.hidden || root.classList.contains('is-dragging'); },
            onState: function (name) {
                if (name === 'drag-up') {
                    try { player.warm('drag-hold'); } catch (e) { /* ignore */ }
                }
            },
            categories: categoriesForNow,
            idleClip: idleClip,
            sleepyClip: sleepyClip
        });
        director.start();

        // 首屏之后空闲时预取索引：40KB(gzip)，换来第一次提问就能同步回答
        setTimeout(function () { try { if (SEARCH) SEARCH.ensure(); } catch (e) { /* ignore */ } }, CONFIG.search.preloadDelayMs);
        preloadClips();
        setTimeout(function () {
            if (!player) return;
            try { player.warm('drag'); } catch (e) { /* ignore */ }
        }, 2600);
    }

    function init() {
        if (root && document.getElementById(CONFIG.hostId || 'deepseek-pet')) {
            applyPos();
            lastCtxAt = 0;                       // 换页了，重置冷却
            setTimeout(function () {
                tagPageLine();
                runContext();
            }, 700);
            return;
        }
        load();
        build();
        mountSpeech();
        mountActions();
        mountZoneDebug();
        applyShadow();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    document.addEventListener('pjax:complete', init);
    document.addEventListener('pjax:success', init);   // 有些主题只发这个
    document.addEventListener('pjax:end', init);

    /* 内核装配：脚本在 body 末尾，此时 DOM 已就绪 */
    try { mountSpeech(); }
    catch (e) { window.__petBootErr = String((e && e.stack) || e); console.error('[pet] mountSpeech failed', e); }

/* 调试入口：控制台与冒烟测试用；其余模块保持在模块作用域内 */
window.PetKernel = window.PetKernel || PetKernel;
window.PetSearch = PetSearch;
window.PetZones = PetZones;
window.PetDebug = window.PetDebug || {};
window.PetDebug[CONFIG.hostId || 'deepseek-pet'] = {
    kernel: KERNEL, search: PetSearch, zones: PetZones, adapter: PetAdapter, config: CONFIG
};
