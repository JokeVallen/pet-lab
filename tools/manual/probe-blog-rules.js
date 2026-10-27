const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9457);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8132);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-bw3',
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

        console.log('线上模块:', await ev(`
            import('/js/pet/modules/rules.js').then(function (m) {
                var R = m.PetRules;
                R.registerWhen('isLongRead', { kind: 'number', test: function (c, v) { return c.words > v; } });
                var c = { page: 'post', tags: [], words: 900, comments: 0, scroll: 0, dark: false, hour: 12 };
                var ok = R.compileWhen({ isLongRead: 800 })(c, {});
                var bad = R.compileWhen({ isLongRead: 1000 })(c, {});
                return JSON.stringify({
                    内置键: R.getWhenKeys().length,
                    自定义命中: ok,
                    自定义不命中: bad,
                    未知键: R.compileWhen({ typoKey: 1 })(c, {})
                });
            })
        `));

        console.log('宠物在页面里:', await ev("!!(window.PetKernel || document.querySelector('#pet, .pet-root, [data-pet]'))"));
    } finally {
        chrome.kill();
    }
})();
