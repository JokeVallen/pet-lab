const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9633);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8383);
const PAGE = process.argv[4] || '/posts/2026/01/01/7bac37c2e8d2/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-diag',
        BASE + PAGE], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const errors = [];
    const send = (m, p) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) {
            const d = r.result.exceptionDetails.exception;
            return 'EXC ' + (d && d.description ? d.description.split('\n').slice(0, 2).join(' | ') : '');
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
                errors.push(((d.exception && d.exception.description) || '').split('\n')[0]);
            }
        });
        await send('Runtime.enable');
        await sleep(15000);

        console.log('config.site:', await ev("JSON.stringify(PetDebug['deepseek-pet'].config.site)"));
        console.log('site.available:', await ev("PetDebug['deepseek-pet'].site.available()"));
        console.log('site.version:', await ev("PetDebug['deepseek-pet'].site.version()"));
        console.log('actions 数量:', await ev("PetDebug['deepseek-pet'].site.actionList().length"));
        console.log('actions:', await ev("JSON.stringify(PetDebug['deepseek-pet'].site.actionList().map(a=>a.id))"));
        console.log('ensureReady:', await ev("PetDebug['deepseek-pet'].adapter.ensureReady().then(r=>'ready='+r)"));
        await sleep(1500);
        console.log('ready 后 actions:', await ev("JSON.stringify(PetDebug['deepseek-pet'].site.actionList().map(a=>a.id))"));
        console.log('navigate:', await ev("PetDebug['deepseek-pet'].site.action('navigation.open',{path:'/algorithm/'}).then(r=>JSON.stringify(r))"));
        console.log('异常:', errors.length ? errors.slice(0, 5).join('\n') : '无');
    } finally {
        chrome.kill();
    }
})();
