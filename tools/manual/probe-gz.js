const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9670);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8420);
const PAGE = process.argv[4] || '/posts/2026/10/02/3a299c615956/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-gz',
        BASE + PAGE], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const reqs = [];
    const errors = [];
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
        for (let i = 0; i < 80 && !url; i++) {
            try {
                const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
                const p = list.find((t) => t.type === 'page' && t.url.indexOf('http') === 0);
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
                errors.push(((d.exception && d.exception.description) || '').split('\n')[0]);
            }
            if (m.method === 'Network.responseReceived') {
                const u = m.params.response.url.replace(BASE, '');
                if (/content-db|search-index|page-context/.test(u)) {
                    reqs.push(u + '  [' + m.params.response.status + ']');
                }
            }
        });
        await send('Runtime.enable');
        await send('Network.enable');
        await sleep(15000);

        console.log('宠物挂载:', await ev("!!document.querySelector('.dp-root')"));
        console.log('--- 检索（应命中 .gz）---');
        console.log(await ev("PetDebug['deepseek-pet'].reply('有没有讲对象池的')"));
        await sleep(1500);
        console.log('--- 全文取详情（应命中 .gz）---');
        console.log(await ev("SiteAPI.currentContext().then(c=>c.contentId).then(id=>SiteAPI.content().get('document',id)).then(d=>d && d.title)"));
        await sleep(1500);
        console.log('网络:', reqs.join('\n      ') || '（无）');
        console.log('异常:', errors.length ? errors.slice(0, 3).join('\n') : '无');
    } finally {
        chrome.kill();
    }
})();
