const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9582);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8332);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-guard3',
        BASE + '/zone-editor.html'], { stdio: 'ignore' });

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

        const before = await ev("fetch('config/pet.yaml?ts=' + Date.now(), {cache:'no-store'}).then(r=>r.text())");
        await ev("saveZones()");
        await sleep(2500);
        console.log('保存状态:', await ev("document.getElementById('status').textContent"));
        const after = await ev("fetch('config/pet.yaml?ts=' + Date.now(), {cache:'no-store'}).then(r=>r.text())");
        const na = before.replace(/\r\n/g, '\n'), nb = after.replace(/\r\n/g, '\n');
        console.log('文件长度:', na.length, '→', nb.length);
        const A = new Set(na.split('\n')), B = new Set(nb.split('\n'));
        console.log('新增行:', JSON.stringify([...B].filter((x) => !A.has(x)).slice(0, 8)));
        console.log('丢失行:', JSON.stringify([...A].filter((x) => !B.has(x)).slice(0, 8)));
    } finally {
        chrome.kill();
    }
})();
