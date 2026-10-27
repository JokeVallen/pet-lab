const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9415;
const BASE = 'http://127.0.0.1:8112';

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-t2',
        `${BASE}/home.html`], { stdio: 'ignore' });

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

        await send('Runtime.evaluate', { expression: "localStorage.setItem('pet-i18n','en')", returnByValue: true });
        await send('Page.enable');
        await send('Page.navigate', { url: BASE + '/index.html' });
        await sleep(3000);

        const check = await send('Runtime.evaluate', {
            expression: `JSON.stringify({
                url: location.pathname,
                title: document.title,
                h1: document.querySelector('h1') && document.querySelector('h1').textContent,
                lab: document.querySelector('.lab h3') && document.querySelector('.lab h3').textContent,
                btn: [...document.querySelectorAll('.lab button')].map(b => b.textContent).slice(0, 4),
                stillCn: [...document.querySelectorAll('[data-i18n]')].filter(e => /[\\u4e00-\\u9fa5]/.test(e.textContent)).map(e => e.textContent).slice(0, 5)
            })`,
            returnByValue: true
        });
        console.log(check.result.result.value);
    } finally {
        chrome.kill();
    }
})();
