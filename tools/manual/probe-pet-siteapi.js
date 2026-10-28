const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9621);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8371);
const PAGE = process.argv[4] || '/posts/2026/01/01/7bac37c2e8d2/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-petsite',
        BASE + PAGE], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const errors = [];
    const requests = [];
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
                errors.push((d.url || '?') + ':' + d.lineNumber + ' ' + ((d.exception && d.exception.description) || '').split('\n')[0]);
            }
            if (m.method === 'Network.requestWillBeSent') {
                const u = m.params.request.url;
                if (u.indexOf('content-db') >= 0 || u.indexOf('pet-index') >= 0 || u.indexOf('site-api') >= 0) requests.push(u.replace(BASE, ''));
            }
        });
        await send('Runtime.enable');
        await send('Network.enable');
        await sleep(14000);

        console.log('宠物挂载:', await ev("!!document.querySelector('.dp-root')"));
        console.log('SiteAPI:', await ev('!!window.SiteAPI'));
        console.log('启动 9s 后 context:', await ev("JSON.stringify(PetDebug['deepseek-pet'].context())"));
        console.log('启动 9s 后已请求:', requests.join(' | ') || '（无内容库请求）');

        console.log('--- 等就绪 + 元信息（9s）---');
        await sleep(3000);
        console.log('context:', await ev("JSON.stringify(PetDebug['deepseek-pet'].context())"));
        console.log('已请求:', requests.join(' | ') || '（无）');

        console.log('--- 提问：有没有讲对象池的 ---');
        const ans = await ev("PetDebug['deepseek-pet'].reply('有没有讲对象池的')");
        console.log('回答:', ans);

        console.log('--- 提问：这篇讲什么 ---');
        console.log('回答:', await ev("PetDebug['deepseek-pet'].reply('这篇讲什么')"));

        console.log('--- 提问：今天几号 ---');
        console.log('回答:', await ev("PetDebug['deepseek-pet'].reply('现在几点')"));

        console.log('--- 站内跳转走 action ---');
        console.log('navigate:', await ev("PetDebug['deepseek-pet'].site.navigate('/algorithm/').then(function(r){return 'ok=' + r})"));
        await sleep(1500);
        console.log('跳转后路径:', await ev('location.pathname'));

        console.log('--- 异常 ---');
        console.log(errors.length ? errors.slice(0, 5).join('\n') : '无');
    } finally {
        chrome.kill();
    }
})();
