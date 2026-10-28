const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9583);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8333);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-guard4',
        'about:blank'], { stdio: 'ignore' });

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
    let dialog = null;
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
            if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
            if (m.method === 'Page.javascriptDialogOpening') dialog = m.params;
        });
        await send('Runtime.enable');
        await send('Page.enable');

        // A. 没改过文件 → 保存不应该弹窗
        await send('Page.navigate', { url: BASE + '/config-editor.html' });
        await sleep(3500);
        await ev("document.querySelector('button.primary').click()");
        await sleep(4000);
        console.log('A 正常保存:', await ev("document.getElementById('status').textContent"), '| 弹窗:', dialog ? '有' : '无');

        // B. rules-editor：载入后背后改文件 → 保存应弹窗
        dialog = null;
        await send('Page.navigate', { url: BASE + '/rules-editor.html' });
        await sleep(3500);
        console.log('B rules 已载入:', await ev("String(!!window.__lastLoaded)"), '| rules:', await ev("rules.length"));
        await ev(`fetch('/api/save', {method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ path: 'config/pet.yaml', content: 'name: hacked\\n' })}).then(r => r.json())`);
        await sleep(500);
        dialog = null;
        await ev("document.querySelector('button.primary').click()");
        for (let i = 0; i < 30 && !dialog; i++) await sleep(100);
        console.log('B 弹窗:', dialog ? dialog.message.split('\n')[0].slice(0, 40) : '（没有）');
        if (dialog) { await send('Page.handleJavaScriptDialog', { accept: false }); dialog = null; }
        await sleep(600);
        console.log('B 取消后状态:', await ev("document.getElementById('status').textContent"));
    } finally {
        chrome.kill();
    }
})();
