const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9462);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8136);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-bw6',
        `${BASE}/algorithm/`], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
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
        ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
        await send('Runtime.enable');
        await sleep(4000);

        const expr = `import('/js/pet/adapter.js').then(function (m) {
            var A = m.PetAdapter || m.default;
            var base = { page: 'post', type: '', tags: [], words: 500, comments: 0, dark: false, hour: 12, scroll: 0.1 };
            function pick(over) { return A.pickState(Object.assign({}, base, over)); }
            return JSON.stringify({
                hour3: pick({ hour: 3 }),
                hour12: pick({ hour: 12 }),
                dark22: pick({ dark: true, hour: 22 }),
                dark12: pick({ dark: true, hour: 12 }),
                scroll050: pick({ scroll: 0.5 }),
                scroll012: pick({ scroll: 0.12 }),
                scroll092: pick({ scroll: 0.92 }),
                scroll093: pick({ scroll: 0.93 }),
                scroll002: pick({ scroll: 0.02 }),
                pageHome: pick({ page: 'home', scroll: 0.5 })
            });
        })`;
        console.log('stateRules:', await ev(expr));
    } finally {
        chrome.kill();
    }
})();
