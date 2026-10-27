/*!
 * player 模块 —— 双缓冲播放器
 *
 * 从宠物本体原样拆出。职责：两个 <video> 轮流当前台、换源在后台做、
 * 解码完成后才交换；一次性动作播完回调，循环动作等外部调度。
 *
 * 依赖通过第二个参数注入，不再访问外部作用域：
 *   createPlayer(stageEl, { clips, config, pick, randInt })
 */


    function createPlayer(stage, deps) {

        /* 依赖注入：宠物本体把缓存与工具函数传进来，播放器不认识外部作用域 */
        var clipCache = deps.clips || {};
        var CONFIG = deps.config || { animDir: '/images/pet/anim/' };
        var pick = deps.pick;
        var randInt = deps.randInt;

        var els = [];
        var front = 0;      // 当前前台元素下标
        var token = 0;      // 换代号：过期回调直接丢弃
        var current = '';   // 当前动画名
        var mirror = false;
        var onEnded = null;

        function makeEl() {
            var v = document.createElement('video');
            v.className = 'dp-video';
            v.muted = true;
            v.defaultMuted = true;
            v.playsInline = true;
            v.setAttribute('muted', '');
            v.setAttribute('playsinline', '');
            v.setAttribute('webkit-playsinline', '');
            v.setAttribute('aria-hidden', 'true');
            v.preload = 'auto';
            return v;
        }

        for (var i = 0; i < 2; i++) {
            els.push(makeEl());
            stage.appendChild(els[i]);
        }

        function handleEnded() {
            if (onEnded) onEnded(current);
        }

        /**
         * 换到某个动画。
         * @param {string} name   动画名
         * @param {boolean} once  true = 播一遍；false = 循环
         * @param {Function} [done] 播完后的回调（仅 once 有效）
         */
        /** 换层级：两块屏都解码好了，这里只挪 is-front，不重新 load */
        function promote(el, once) {
            var old = els[front];
            if (old && old !== el) {
                old.onended = null;
                old.onerror = null;
                old.classList.remove('is-front');
                old.pause();
            }
            el.classList.add('is-front');
            stage.classList.add('is-ready');
            front = els.indexOf(el);
            el.loop = !once;
            el.onended = once ? handleEnded : null;
            el.playbackRate = once ? 1.22 : 1;
            el.style.transform = mirror ? 'scaleX(-1)' : '';
            // 只在确实偏离开头时才 seek：seek 会让 readyState 掉回 1，反而引入延迟
            try { if (el.currentTime > 0.15) { if (el.fastSeek) el.fastSeek(0); else el.currentTime = 0; } } catch (e) { /* ignore */ }
            var pp = el.play();
            if (pp && pp.catch) pp.catch(function () {});
        }

        function play(name, once, done) {
            if (!name) return;

            // 快速通道：另一块屏上已经备好这一段 → 直接换层，省掉 load + 等首帧
            for (var qi = 0; qi < els.length; qi++) {
                if (els[qi].getAttribute('data-clip') === name && els[qi].readyState >= 2) {
                    current = name;
                    onEnded = once ? function () { if (done) done(); } : null;
                    promote(els[qi], once);
                    return;
                }
            }

            var gen = ++token;
            var el = els[front ^ 1];          // 后台元素
            var url = CONFIG.animDir + name + '.' + (CONFIG.clipExt || 'webm');
            current = name;
            el.setAttribute('data-clip', name);
            onEnded = once ? function () { if (done) done(); } : null;

            // 命中缓存：同步换源，交互没有网络等待
            if (clipCache[name]) {
                el.src = clipCache[name];
                el.load();
                arm(el, gen, once);
                return;
            }

            fetch(url, { cache: 'force-cache' })
                .then(function (r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.blob();
                })
                .then(function (blob) {
                    if (gen !== token) return;
                    if (!clipCache[name]) clipCache[name] = URL.createObjectURL(blob);
                    el.src = clipCache[name];
                    el.load();
                    arm(el, gen, once);
                })
                .catch(function (err) {
                    if (gen !== token) return;
                    console.warn('[pet] 动画加载失败：' + name, err);
                    if (done) done();          // 兜底：别把链断在这儿
                });
        }

        function arm(el, gen, once) {
            function onReady() {
                el.removeEventListener('loadeddata', onReady);
                if (gen !== token) return;

                var old = els[front];
                if (old && old !== el) {
                    // 拆雷：旧元素上残留的 ended 会在被换下后继续触发切换，形成连环跳切
                    old.onended = null;
                    old.onerror = null;
                    old.classList.remove('is-front');
                    old.pause();
                }
                el.classList.add('is-front');
                stage.classList.add('is-ready');
                front = front ^ 1;

                el.loop = !once;
                // 一次性动作稍微提一点速，抵消素材本身的慢节奏；待机保持 1.0 不动
                el.playbackRate = once ? 1.22 : 1;
                el.onended = once ? handleEnded : null;
                el.style.transform = mirror ? 'scaleX(-1)' : '';

                var p = el.play();
                if (p && p.catch) p.catch(function () { /* 自动播放被拦：保留首帧 */ });
            }
            el.addEventListener('loadeddata', onReady);
        }

        /* 前台元素真正开始出帧了吗？首帧没就绪时 CSS 仍显示静帧，
           否则用户会看到"取了半天一动不动"。 */
        function frontReady() {
            var el = els[front];
            if (!el) return false;
            return el.readyState >= 2 && !el.paused && el.currentTime > 0;
        }

        return {
            play: play,
            ready: frontReady,
            name: function () { return current; },
            setMirror: function (v) { mirror = !!v; },
            /** 预热：把一段动画装到后台屏并停在第一帧，等着被快速通道直接换上来 */
            warm: function (name) {
                if (!clipCache[name]) return false;
                var el = els[front ^ 1];
                if (!el || el.getAttribute('data-clip') === name) return false;
                if (el.classList.contains('is-front')) return false;
                el.setAttribute('data-clip', name);
                el.src = clipCache[name];
                el.loop = true;
                el.load();
                // 播一下再停：确保解码器真的产出一帧，否则换上来是空白
                var wp = el.play();
                if (wp && wp.catch) wp.catch(function () {});
                setTimeout(function () { try { el.pause(); } catch (e) { /* ignore */ } }, 220);
                return true;
            },
            pause: function () { els.forEach(function (e) { e.pause(); }); },
            resume: function () {
                var e = els[front];
                if (e) {
                    var p = e.play();
                    if (p && p.catch) p.catch(function () {});
                }
            }
        };
    
    }

    export const PetPlayer = { createPlayer: createPlayer };
