/*!
 * search 模块 —— 站内检索
 *
 * 负责：懒加载索引、中文二字滑窗分词、四字段加权打分、生成回答文本。
 * 索引本身由站点构建期生成（博客里是 scripts/pet-index.js）。
 */

import { PetContent } from '../content/index.js';

const C = PetContent;


    function createSearch(opts) {
        var url = (opts && opts.url) || '/pet-index.json';
        var maxResults = Math.max(1, Math.min(10, Number(opts && opts.maxResults) || 1));
        var idxRows = null;    // 索引缓存
        var idxReq = null;     // 进行中的请求
        var idxPending = null; // 请求期间到达的问题
        var say = (opts && opts.say) || function () {};

        function loadPetIndex() {
            if (idxRows || idxReq) return;
            try {
                idxReq = fetch(url, { cache: 'force-cache' })
                    .then(function (r) { return r.json(); })
                    .then(function (j) { idxRows = (j && j.rows) || []; })
                    .catch(function () { idxRows = []; })
                    .then(function () {
                        // 之前因为索引没加载而搁置的问题，补答一次
                        if (idxPending) {
                            var q = idxPending;
                            idxPending = null;
                            var ans = indexReply(q);
                            if (ans) appendMessage('pet', ans);   // 对话框里只回对话，不冒气泡
                        }
                    });
            } catch (e) { idxRows = []; }
        }
        function indexSearch(q) {
            if (!idxRows || !idxRows.length) return null;
            var terms = splitTerms(q);
            if (!terms.length) return null;
        
            var scored = [];
            for (var i = 0; i < idxRows.length; i++) {
                var r = idxRows[i];
                var title = (r.t || '').toLowerCase();
                var tags = (r.g || []).join(' ').toLowerCase();
                var cats = (r.c || []).join(' ').toLowerCase();
                var ex = (r.x || '').toLowerCase();
                var score = 0;
                for (var k = 0; k < terms.length; k++) {
                    var w = terms[k];
                    if (title.indexOf(w) >= 0) score += 6;
                    if (tags.indexOf(w) >= 0) score += 4;
                    if (cats.indexOf(w) >= 0) score += 3;
                    if (ex.indexOf(w) >= 0) score += 2;
                }
                if (score > 0) scored.push({ r: r, s: score });
            }
            if (!scored.length) return null;
            scored.sort(function (a, b) {
                return b.s - a.s || String(b.r.d || '').localeCompare(String(a.r.d || ''));
            });
            return scored;
        }
        function indexReply(q) {
            var hits = indexSearch(q);
            if (hits === null) {
                if (!idxRows) {
                    idxPending = q;
                    loadPetIndex();
                    return C.t('search.pending');
                }
                return C.t('search.notFound');
            }
            var top = hits[0].r;
            var kindName = top.k === 'card' ? C.t('search.kindCard')
                : (top.k === 'page' ? C.t('search.kindPage') : C.t('search.kindPost'));
            if (maxResults <= 1) {
                var more = hits.length > 1 ? C.t('search.andMore', { n: hits.length - 1 }) : '';
                return C.t('search.closest', { kind: kindName, title: top.t, more: more, url: top.u });
            }
            // 配了更多条数：按顺序列出来
            var lines = [C.t('search.listHead', { kind: kindName, title: top.t, url: top.u })];
            var extra = Math.min(maxResults, hits.length) - 1;
            for (var i = 1; i <= extra; i++) {
                lines.push(C.t('search.listItem', { title: hits[i].r.t, url: hits[i].r.u }));
            }
            if (hits.length > maxResults) lines.push(C.t('search.listMore', { n: hits.length - maxResults }));
            return lines.join('\n');
        }

        /* 停用词和意图正则都随语言变化，按语言缓存 */
        var stopRe = null, intentRe = null, reLang = null;
        function ensureRes() {
            if (reLang === C.lang && stopRe && intentRe) return;
            var esc = function (x) { return String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
            var sw = C.list('search.stopwords').map(esc);
            stopRe = new RegExp('^(' + sw.join('|') + ')$');
            try { intentRe = new RegExp(C.t('search.intent')); } catch (e) { intentRe = /$^/; }
            reLang = C.lang;
        }

        function splitTerms(q) {
            ensureRes();
            var STOP = stopRe;
            var raw = String(q).toLowerCase()
                .replace(/[，。！？、,.!?：:；;（）()「」"']/g, ' ')
                .split(/\s+/)
                .filter(function (x) { return x && !STOP.test(x); });

            var out = [];
            raw.forEach(function (seg) {
                if (/[\u4e00-\u9fa5]/.test(seg) && seg.length > 2) {
                    // 中文没有空格：用二字滑窗切，再保留整段
                    for (var i = 0; i + 1 < seg.length; i++) out.push(seg.substr(i, 2));
                    out.push(seg);
                } else if (seg.length >= 2) {
                    out.push(seg);
                }
            });

            var seen = {}, uniq = [];
            for (var j = 0; j < out.length; j++) {
                var x2 = out[j];
                if (x2.length >= 2 && !seen[x2]) { seen[x2] = 1; uniq.push(x2); }
            }
            return uniq.slice(0, 10);
        }

        return {
            matches: function (text) { ensureRes(); return intentRe.test(text); },
            ensure: loadPetIndex,
            search: indexSearch,
            reply: function (q) {
                var ans = indexReply(q);
                if (ans) say(ans, 4800);
                return ans;
            },
            answer: function (q) { return indexReply(q); },
            rows: function () { return idxRows; }
        };
    }

    export const PetSearch = { createSearch: createSearch };
