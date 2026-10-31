const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9496);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8255);
const out = process.argv[4] || 'swap-chat.png';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,860',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-p3',
        `${BASE}/demo.html`], { stdio: 'ignore' });

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
        await sleep(5000);

        console.log('根节点:', await ev(`
            (function(){
                var r = document.querySelector('.dp-root');
                if (!r) return '没有 .dp-root';
                var s = getComputedStyle(r);
                return JSON.stringify({ id: r.id, 主色: s.getPropertyValue('--dp-primary').trim(), 宽: s.getPropertyValue('--dp-w').trim() });
            })()
        `));
        console.log('聊天标题色:', await ev(`
            (function(){
                var h = document.querySelector('.dp-chat-head span');
                if (!h) return '无';
                return getComputedStyle(h).color;
            })()
        `));

        await ev("document.querySelector('[data-dp-action=chat]').click()");
        await sleep(600);
        const s = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/' + out, Buffer.from(s.result.data, 'base64'));
        console.log('截图:', out);
    } finally {
        chrome.kill();
    }
})();
