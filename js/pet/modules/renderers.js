/*!
 * 渲染器（renderers）：把一段文本变成可见的东西。
 *
 * 只认 DOM，不认业务：不知道这是"动作反馈"还是"搜索结果"。
 * 供 speech 模块注入，可单独替换（例如换成语音、换成弹幕）。
 */


    /* 把回复里的站内路径渲染成可点的链接。
     *
     * 链接文字优先用页面标题（避免把 /posts/2026/01/01/xxxx/ 这种明文糊在对话里）；
     * 调用方通过 opts.titleOf(path) 提供映射，取不到标题就退回原文路径，绝不显示空链接。
     */
    function fillText(el, text, opts) {
        var str = String(text || '');
        var titleOf = (opts && opts.titleOf) || null;
        var re = /(\/[A-Za-z0-9_\-.~#/?=&%+]*[A-Za-z0-9_\-])/g;
        var last = 0;
        var m;
        while ((m = re.exec(str))) {
            var path = m[1];
            var label = '';
            if (titleOf) {
                try {
                    label = String(titleOf(path) || '');
                } catch (e) {
                    label = '';
                }
            }
            if (!label) label = path;          // 没标题就明文，至少不丢信息
            if (m.index > last) el.appendChild(document.createTextNode(str.slice(last, m.index)));
            var a = document.createElement('a');
            a.href = path;
            a.className = 'dp-link';
            a.textContent = label;
            a.title = label === path ? path : label;
            a.setAttribute('data-path', path);
            el.appendChild(a);
            last = m.index + path.length;
        }
        if (last < str.length) el.appendChild(document.createTextNode(str.slice(last)));
    }

    /** 气泡渲染器：root 是宠物容器，内部查找 .dp-bubble */
    function bubble(rootEl, opts) {
        var timer = null;
        var titleOf = (opts && opts.titleOf) || null;
        return function render(text, ttl) {
            if (!rootEl || !text) return;
            var b = rootEl.querySelector('.dp-bubble');
            if (!b) return;
            b.textContent = '';
            fillText(b, text, { titleOf: titleOf });   // 气泡里的站内路径同样可点
            b.classList.add('is-show');
            clearTimeout(timer);
            timer = setTimeout(function () {
                b.classList.remove('is-show');
            }, ttl || 4200);
        };
    }

    /** 对话框渲染器：logEl 是 .dp-chat-log */
    function dialog(logEl, opts) {
        var max = (opts && opts.max) || 10;
        var titleOf = (opts && opts.titleOf) || null;
        return function render(text) {
            if (!logEl || !text) return;
            var msg = document.createElement('div');
            msg.className = 'dp-msg is-pet';
            fillText(msg, text, { titleOf: titleOf });
            logEl.appendChild(msg);
            while (logEl.children.length > max) logEl.removeChild(logEl.firstChild);
            logEl.scrollTop = logEl.scrollHeight;
            if (opts && opts.onRendered) opts.onRendered(text);
        };
    }

    export const PetRenderers = { bubble: bubble, dialog: dialog, fillText: fillText };
