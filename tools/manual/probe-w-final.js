const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9464);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8207);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1000',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-we',
        `${BASE}/rules-editor.html`], { stdio: 'ignore' });

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
        await send('Page.enable');
        await sleep(3000);

        console.log('状态栏:', await ev("document.getElementById('status').textContent"));
        console.log('规则数:', await ev("rules.length"));
        console.log('滑杆数:', await ev("document.querySelectorAll('.wrow input[type=range]').length"));
        console.log('图例:', await ev("document.querySelector('.wlegend').textContent"));

        // 改权重 → 撤销按钮变可用 → undo 能回退
        await ev("(function(){var i=document.querySelectorAll('.wrow input[type=range]')[0]; i.value=60; i.dispatchEvent(new Event('input')); pushHistory();})()");
        console.log('撤销可用:', await ev("!document.getElementById('undoBtn').disabled"));
        console.log('权重:', await ev("JSON.stringify(stateWeights)"));
        console.log('分布条:', await ev("[...document.querySelectorAll('.wbar i')].map(e=>e.style.width).join(' | ')"));

        await ev("document.querySelector('.weights').scrollIntoView({block:'start'})");
        await sleep(300);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/rules-weights.png', Buffer.from(shot.result.data, 'base64'));
    } finally {
        chrome.kill();
    }
})();
