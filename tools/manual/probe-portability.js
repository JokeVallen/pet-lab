const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9491);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8249);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-port',
        `${BASE}/demo.html`], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const urls = new Set();
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
        ws.addEventListener('message', (e) => {
            const m = JSON.parse(e.data);
            if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
            if (m.method === 'Network.requestWillBeSent') urls.add(m.params.request.url);
        });
        await send('Runtime.enable');
        await send('Network.enable');
        await send('Page.enable');
        await sleep(1500);
        await send('Page.reload', { ignoreCache: true });
        await sleep(6000);

        console.log('挂载点 id:', await ev("(document.querySelector('[id$=pet]')||{}).id || '无'"));
        console.log('气泡/聊天标题:', await ev("[...document.querySelectorAll('.dp-chat-head span')].map(e=>e.textContent).join('|')"));
        console.log('运行时配置 name:', await ev("(window.PetKernel && PetKernel.config && PetKernel.config.name) || '取不到'"));
        const clipUrls = [...urls].filter((u) => /\/images\/pet/.test(u));
        console.log('请求的动画地址:', clipUrls.slice(0, 3).join('  '));
        console.log('请求总数:', urls.size, '｜其中动画:', clipUrls.length);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/port-portrait.png', Buffer.from(shot.result.data, 'base64'));
    } finally {
        chrome.kill();
    }
})();
