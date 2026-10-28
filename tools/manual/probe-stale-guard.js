const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9580);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8330);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-guard',
        BASE + '/config-editor.html'], { stdio: 'ignore' });

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
        await sleep(4000);

        console.log('1) 已记录基线哈希:', await ev("typeof baseHash === 'string' && baseHash.length === 40"));

        // 背后改文件：模拟另一个标签页刚存过
        await ev(`fetch('/api/save', {method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ path: 'config/pet.yaml', content: (document.getElementById('yaml').textContent) + '\\n# changed behind the editor\\n' })}).then(r => r.json())`);
        await sleep(400);

        // 点保存 —— 应该弹确认框
        dialog = null;
        await ev("document.querySelector('button.primary').click()");
        for (let i = 0; i < 30 && !dialog; i++) await sleep(100);
        console.log('2) 弹窗:', dialog ? dialog.message.split('\n')[0].slice(0, 60) : '（没有弹窗！）');

        // 取消
        if (dialog) { await send('Page.handleJavaScriptDialog', { accept: false }); dialog = null; }
        await sleep(800);
        console.log('3) 取消后状态:', await ev("document.getElementById('status').textContent"));
        console.log('4) 文件里还留着别人的改动:', await ev(`
            fetch('config/pet.yaml?ts=' + Date.now(), {cache:'no-store'}).then(r => r.text()).then(t => t.indexOf('changed behind the editor') >= 0)
        `));

        // 再来一次，这次确认覆盖
        await ev("document.querySelector('button.primary').click()");
        for (let i = 0; i < 30 && !dialog; i++) await sleep(100);
        if (dialog) { await send('Page.handleJavaScriptDialog', { accept: true }); dialog = null; }
        await sleep(5000);
        console.log('5) 确认后状态:', await ev("document.getElementById('status').textContent"));
        console.log('6) 覆盖后别人的改动已消失:', await ev(`
            fetch('config/pet.yaml?ts=' + Date.now(), {cache:'no-store'}).then(r => r.text()).then(t => t.indexOf('changed behind the editor') < 0)
        `));
    } finally {
        chrome.kill();
    }
})();
