const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9498);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8257);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,860',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-blog',
        `${BASE}/`], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const errs = [];
    const send = (m, p) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) {
            const d = r.result.exceptionDetails.exception;
            return 'EXC ' + (d && d.description ? d.description.split('\n')[0] : '');
        }
        return r.result && r.result.result ? r.result.result.value : undefined;
    };

    try {
        let url;
        for (let i = 0; i < 60 && !url; i++) {
            try {
                const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
                const p = list.find((t) => t.type === 'page');
                if (p) url = p.webSocketDebuggerUrl;
            } catch (e) { /* retry */ }
            if (!url) await sleep(250);
        }
        ws = new WebSocket(url);
        await new Promise((res) => ws.addEventListener('open', res));
        ws.addEventListener('message', (e) => {
            const m = JSON.parse(e.data);
            if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
            if (m.method === 'Runtime.exceptionThrown') {
                const d = m.params.exceptionDetails;
                errs.push(d.exception && d.exception.description ? d.exception.description.split('\n')[0] : d.text);
            }
        });
        await send('Runtime.enable');
        await send('Page.enable');
        await sleep(6000);

        console.log('宠物根节点:', await ev(`
            (function(){
                var r = document.querySelector('.dp-root');
                if (!r) return '没有挂载';
                var s = getComputedStyle(r);
                return JSON.stringify({ id: r.id, class: r.className, 主色: s.getPropertyValue('--dp-primary').trim(), 宽: s.getPropertyValue('--dp-w').trim() });
            })()
        `));
        console.log('立绘:', await ev(`
            (function(){
                var img = document.querySelector('.dp-art');
                return img ? img.getAttribute('src') : '无';
            })()
        `));
        console.log('聊天标题:', await ev("[...document.querySelectorAll('.dp-chat-head span')].map(e=>e.textContent).join('|')"));
        console.log('页面异常:', errs.length ? errs.join(' / ') : '无');
    } finally {
        chrome.kill();
    }
})();
