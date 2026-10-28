const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9650);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8400);
const PAGE = process.argv[4] || '/posts/2026/10/02/3a299c615956/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-v11c',
        BASE + PAGE], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const errors = [];
    const reqs = [];
    const bubbles = [];
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
            if (m.method === 'Network.requestWillBeSent') {
                const u = m.params.request.url.replace(BASE, '');
                if (/content-db\.json|search-index\.json|page-context\.json/.test(u)) reqs.push(u);
            }
        });
        await send('Runtime.enable');
        await send('Network.enable');
        await sleep(15000);

        console.log('宠物挂载:', await ev("!!document.querySelector('.dp-root')"));
        console.log('请求:', reqs.join(' | ') || '（无）');
        console.log('context:', await ev("JSON.stringify(PetDebug['deepseek-pet'].context())"));
        console.log('内容库 JSON 请求次数:', reqs.filter((u) => u.indexOf('content-db.json') >= 0).length);

        console.log('--- 这篇讲什么（不应触发内容库）---');
        console.log(await ev("PetDebug['deepseek-pet'].reply('这篇讲什么')"));
        console.log('请求:', reqs.join(' | '));

        console.log('--- 检索（走 search-index）---');
        console.log(await ev("PetDebug['deepseek-pet'].reply('有没有讲对象池的')"));
        console.log('请求:', reqs.join(' | '));

        console.log('--- 错误码 ---');
        console.log(await ev("PetDebug['deepseek-pet'].site.action('nope.nope',{}).then(r=>JSON.stringify(r))"));

        console.log('--- 切主题 ---');
        const before = await ev("(document.querySelector('.dp-bubble')||{}).textContent || ''");
        await ev("document.documentElement.setAttribute('data-theme','dark')");
        await sleep(1500);
        console.log('theme:', await ev("PetDebug['deepseek-pet'].adapter.isDark()"));
        console.log('气泡前:', before);
        console.log('气泡后:', await ev("(document.querySelector('.dp-bubble')||{}).textContent || '（无）'"));

        console.log('--- 滚动 ---');
        await ev('window.scrollTo(0, Math.round(document.documentElement.scrollHeight*0.95))');
        await sleep(3200);
        console.log('ratio:', await ev("PetDebug['deepseek-pet'].adapter.scrollRatio()"));
        console.log('气泡:', await ev("(document.querySelector('.dp-bubble')||{}).textContent || '（无）'"));

        console.log('--- 异常 ---');
        console.log(errors.length ? errors.slice(0, 4).join('\n') : '无');
    } finally {
        chrome.kill();
    }
})();
