const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9424);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8171);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,1000',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-sv2',
        `${BASE}/config-editor.html`], { stdio: 'ignore' });

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
        await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', res); });
        ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
        await send('Runtime.enable');
        await send('Page.enable');
        await sleep(2600);

        console.log('fetch 首行:', await ev(`(async () => {
            const r = await fetch('config/pet.yaml?ts=' + Date.now(), { cache: 'no-store' });
            const t = new TextDecoder('utf-8').decode(await r.arrayBuffer());
            return t.split('\\n')[0];
        })()`));

        console.log('res.text() 首行:', await ev(`(async () => {
            const r = await fetch('config/pet.yaml?ts=' + Date.now(), { cache: 'no-store' });
            return (await r.text()).split('\\n')[0];
        })()`));

        console.log('localStorage 键:', await ev("Object.keys(localStorage).join(',')"));
        console.log('编辑器 model.name:', await ev("typeof state !== 'undefined' && state.name ? state.name : (typeof CONFIG !== 'undefined' && CONFIG.name ? CONFIG.name : 'n/a')"));
        console.log('预览里 name 行:', await ev("(document.getElementById('yaml').textContent.match(/^name:.*$/m)||[''])[0]"));
    } finally {
        chrome.kill();
    }
})();
