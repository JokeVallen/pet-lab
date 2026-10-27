const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9500);
const BASE = process.argv[2] || 'http://127.0.0.1:8259';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,860',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-dbg2',
        `${BASE}/`], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const reqs = [];
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
            if (m.method === 'Network.responseReceived') {
                const u = m.params.response.url;
                if (/custom-global|js\/pet/.test(u)) reqs.push(m.params.response.status + ' ' + u);
            }
        });
        await send('Runtime.enable');
        await send('Network.enable');
        await send('Page.enable');
        await sleep(6000);

        console.log('custom-global / pet 请求:');
        reqs.forEach((r) => console.log('  ' + r));
        console.log('script 标签数:', await ev("[...document.scripts].filter(s=>/custom-global|\\/js\\/pet/.test(s.src)).length"));
        console.log('模块脚本:', await ev("[...document.scripts].filter(s=>s.type==='module').map(s=>s.src).join(',') || '无'"));
        console.log('手动挂载:', await ev(`
            (function(){
                var s = document.createElement('script');
                s.type = 'module';
                s.src = '/js/pet/index.js';
                document.body.appendChild(s);
                return '已插入';
            })()
        `));
        await sleep(4000);
        console.log('插入后挂载:', await ev("!!document.querySelector('.dp-root')"));
        console.log('窗口错误:', await ev("(window.__err||[]).join(' | ') || '无'"));
    } finally {
        chrome.kill();
    }
})();
