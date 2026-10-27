const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9416;
const BASE = 'http://127.0.0.1:8113';

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-t3',
        `${BASE}/index.html`], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const send = (method, params) => new Promise((resolve) => {
        const myId = ++id;
        pending.set(myId, resolve);
        ws.send(JSON.stringify({ id: myId, method, params: params || {} }));
    });

    try {
        let url;
        for (let i = 0; i < 40 && !url; i++) {
            try {
                const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
                const p = list.find((t) => t.type === 'page');
                if (p) url = p.webSocketDebuggerUrl;
            } catch (e) { /* retry */ }
            if (!url) await sleep(250);
        }
        ws = new WebSocket(url);
        await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
        ws.addEventListener('message', (ev) => {
            const m = JSON.parse(ev.data);
            if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
        });
        await send('Runtime.enable');

        await sleep(2500);
        const probe = await send('Runtime.evaluate', {
            expression: `JSON.stringify({
                i18n: typeof window.PetI18n,
                lang: window.PetI18n && PetI18n.lang,
                stored: localStorage.getItem('pet-i18n'),
                sample: window.PetI18n && PetI18n.s('demo.h1'),
                keys: window.PetI18n ? Object.keys(PetI18n).join(',') : null,
                scripts: [...document.querySelectorAll('script')].map(s => s.src || 'inline')
            })`,
            returnByValue: true
        });
        console.log('probe:', JSON.stringify(probe.result));

        const errors = await send('Runtime.evaluate', {
            expression: `JSON.stringify(window.__errors || [])`,
            returnByValue: true
        });
        console.log('errors:', errors.result.result.value);
    } finally {
        chrome.kill();
    }
})();
