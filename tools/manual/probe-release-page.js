const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9530);
const URL = process.argv[2];
const OUT = process.argv[4] || 'D:/Users/User/pet-lab/docs/screenshots/release-page.png';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,1600',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-gh',
        URL], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const send = (m, p) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) return 'EXC';
        return r.result && r.result.result ? r.result.result.value : undefined;
    };

    try {
        let t;
        for (let i = 0; i < 80 && !t; i++) {
            try {
                const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
                const p = list.find((x) => x.type === 'page');
                if (p) t = p.webSocketDebuggerUrl;
            } catch (e) { /* retry */ }
            if (!t) await sleep(250);
        }
        ws = new WebSocket(t);
        await new Promise((res) => ws.addEventListener('open', res));
        ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
        await send('Runtime.enable');
        await send('Page.enable');
        await sleep(9000);

        console.log('标题:', await ev('document.title'));
        console.log('资产行:', await ev(`
            [...document.querySelectorAll('a[href*="/releases/download/"]')].map(a => a.textContent.trim()).join(' | ') || '未找到'
        `));
        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        fs.writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'));
        console.log('截图:', OUT);
    } finally {
        chrome.kill();
    }
})();
