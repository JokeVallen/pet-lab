/*!
 * search 模块 —— 站内检索（只走 SiteAPI）
 *
 * 以前这里自己拉 /pet-index.json、自己切词打分；现在索引归站点，
 * 宠物只负责"把问题变成查询、把结果说成人话"。
 *
 * 对外接口保持旧的形状，只是 answer() 变成了 Promise：
 *   matches(text)  → boolean          是否像"在问站内内容"
 *   ensure()       → void             兼容旧调用（站点自己管加载）
 *   answer(text)   → Promise<string>  一句回答；查不到返回 null
 *
 * 权限：SiteAPI.content().search 属于 read，不碰本机数据。
 */

import { PetContent } from '../content/index.js';
import { PetSite } from '../site.js';

const C = PetContent;

export const PetSearch = {
    createSearch(opts) {
        opts = opts || {};
        const maxResults = Math.max(1, Math.min(10, Number(opts.maxResults) || 1));

        /* 停用词和意图正则来自文案，按语言缓存 */
        let stopRe = null;
        let intentRe = null;
        let reLang = null;

        function ensureRes() {
            if (reLang === C.lang && stopRe && intentRe) return;
            const esc = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const sw = C.list('search.stopwords').map(esc);
            stopRe = new RegExp('^(' + sw.join('|') + ')$');
            try {
                intentRe = new RegExp(C.t('search.intent'));
            } catch (e) {
                intentRe = /$^/;
            }
            reLang = C.lang;
        }

        /** 去掉"有没有/找一下/关于"这类词，留下真正要查的内容 */
        function toQuery(text) {
            ensureRes();
            const raw = String(text || '')
                .replace(/[，。！？、,.!?：:；;（）()「」“”"']/g, ' ')
                .split(/\s+/)
                .filter(Boolean)
                .filter((w) => !stopRe.test(w));
            const joined = raw.join(' ').trim();
            return joined || String(text || '').trim();
        }

        function kindOf(type) {
            switch (type) {
                case 'question': return C.t('search.kindQuestion');
                case 'paper': return C.t('search.kindPaper');
                case 'knowledge': return C.t('search.kindKnowledge');
                case 'algorithm': return C.t('search.kindAlgorithm');
                case 'page': return C.t('search.kindPage');
                case 'post': return C.t('search.kindPost');
                default: return C.t('search.kindPost');
            }
        }

        function format(rows, query) {
            if (!rows.length) return C.t('search.notFound');
            const first = rows[0];
            const kind = kindOf(first.type);
            if (maxResults <= 1) {
                const more = rows.length > 1 ? C.t('search.andMore', { n: rows.length - 1 }) : '';
                return C.t('search.closest', { kind, title: first.title || first.id, more, url: first.path || '' });
            }
            const lines = [C.t('search.listHead', { kind, title: first.title || first.id, url: first.path || '' })];
            const extra = Math.min(maxResults, rows.length) - 1;
            for (let i = 1; i <= extra; i += 1) {
                lines.push(C.t('search.listItem', { title: rows[i].title || rows[i].id, url: rows[i].path || '' }));
            }
            if (rows.length > maxResults) lines.push(C.t('search.listMore', { n: rows.length - maxResults }));
            return lines.join('\n');
        }

        return {
            matches(text) {
                ensureRes();
                return intentRe.test(text);
            },

            ensure() {
                /* 索引归站点，宠物不预加载任何东西 */
            },

            answer(text) {
                if (!PetSite.available()) {
                    return Promise.resolve(C.t('search.unavailable'));
                }
                const query = toQuery(text);
                if (!query) return Promise.resolve(C.t('search.notFound'));
                return PetSite.search(query, { limit: maxResults }).then((rows) => format(rows, query));
            }
        };
    }
};

export default PetSearch;
