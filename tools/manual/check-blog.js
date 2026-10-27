const { spawn } = require('child_process');
const PORT = 9385;
const BASE = 'http://127.0.0.1:8124';
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-blogchk',
        `${BASE}/`], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const send = (m, p) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) return 'EXC';
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
        await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
        ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
        await send('Runtime.enable');
        await send('Page.enable');
        await sleep(3500);

        console.log('pet 挂载:', await ev("JSON.stringify({kernel: typeof window.PetKernel, modules: window.PetKernel ? PetKernel.modules() : null, root: !!document.querySelector('.dp-pet, #pet-root, [class*=dp-]')})"));
        console.log('规则条数:', await ev("import('/js/pet/adapter.js').then(m=>m.PetAdapter.rules.length).catch(e=>'ERR '+e.message)"));
        console.log('搜索模块:', await ev("typeof window.PetSearch"));

        // 访问一篇文章，看是否正常
        await send('Page.navigate', { url: BASE + '/archives/' });
        await sleep(3000);
        console.log('归档页 pet:', await ev("typeof window.PetKernel"));
    } finally {
        chrome.kill();
    }
})();
