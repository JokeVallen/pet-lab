const fs = require('fs');
const PORT = Number(process.argv[2] || 9410);
const BASE = 'http://127.0.0.1:' + (process.argv[3] || 8155);

(async () => {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const send = (m, p) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
    ws.addEventListener('message', (e) => {
        const m = JSON.parse(e.data);
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    });
    await new Promise((r) => ws.addEventListener('open', r));
    await send('Runtime.enable');
    await send('Page.enable');

    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
        if (r.result && r.result.exceptionDetails) return 'EXC';
        return r.result && r.result.result ? r.result.result.value : undefined;
    };

    console.log('卡片数:', await ev("document.querySelectorAll('.grid a.card').length"));
    console.log('顺序:', await ev("[...document.querySelectorAll('.grid a.card h2')].map(h => h.textContent.trim()).join(' / ')"));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/home.png', Buffer.from(shot.result.data, 'base64'));
    ws.close();
})();
