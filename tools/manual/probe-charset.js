const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9420);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8164);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-cs',
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
        await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
        ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
        await send('Runtime.enable');
        await send('Page.enable');
        await sleep(2500);

        console.log('页面标题:', await ev("document.title"));
        console.log('名称输入框值:', await ev("(document.querySelector('#f-name') || document.querySelector('input[name=name]') || {}).value"));
        console.log('YAML 预览首行:', await ev("(document.getElementById('yaml').textContent || '').split('\\n')[0]"));
        console.log('乱码字符数:', await ev("(document.getElementById('yaml').textContent.match(/\\ufffd/g) || []).length"));

        // 检查响应头
        const head = await ev(`(async () => {
            const r = await fetch('config/pet.yaml?ts=1', { method: 'GET' });
            return r.headers.get('content-type');
        })()`);
        console.log('pet.yaml Content-Type:', head);

        const mh = await ev(`(async () => {
            const r = await fetch('README.md?ts=1', { method: 'GET' });
            return r.headers.get('content-type');
        })()`);
        console.log('README.md Content-Type:', mh);
    } finally {
        chrome.kill();
    }
})();
