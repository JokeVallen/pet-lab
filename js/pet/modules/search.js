/*!
 * search 模块 —— 站内检索
 *
 * 负责：懒加载索引、中文二字滑窗分词、四字段加权打分、生成回答文本。
 * 索引本身由站点构建期生成（博客里是 scripts/pet-index.js）。
 */


    function createSearch(opts) {
        var url = (opts && opts.url) || '/pet-index.json';
        var idxRows = null;    // 索引缓存
        var idxReq = null;     // 进行中的请求
        var idxPending = null; // 请求期间到达的问题
        var say = (opts && opts.say) || function () {};

        function loadPetIndex() {
            if (idxRows || idxReq) return;
            try {
                idxReq = fetch('/pet-index.json', { cache: 'force-cache' })
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
                    return '让我翻一下索引……';
                }
                return '没找到相关的内容，换个词试试？';
            }
            var top = hits[0].r;
            var kindName = top.k === 'card' ? '卡片' : (top.k === 'page' ? '页面' : '文章');
            var more = hits.length > 1 ? '，另外还有 ' + (hits.length - 1) + ' 条' : '';
            return '最接近的是' + kindName + '「' + top.t + '」' + more + '：' + top.u;
        }

        function splitTerms(q) {
            var STOP = /^(有没有|有没|没有|关于|相关|相关的|文章|卡片|知识|一下|帮我|找找|看看|什么|哪些|这个|那个|的|了|吗|呢|和|与)$/;
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
            matches: function (text) { var INDEX_INTENT = /有没有|找一下|帮我找|搜一[下搜]|查一下|关于|相关的|哪篇|哪张|哪些文章|站内/; return INDEX_INTENT.test(text); },
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
