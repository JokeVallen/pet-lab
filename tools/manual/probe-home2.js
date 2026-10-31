const fs = require('fs');
const PORT = Number(process.argv[2] || 9411);
const BASE = 'http://127.0.0.1:' + (process.argv[3] || 8156);

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

    console.log('home 卡片数:', await ev("document.querySelectorAll('.grid a.card').length"));
    console.log('note 文本:', await ev("document.querySelector('.note').textContent.replace(/\\s+/g, ' ').trim().slice(0, 90)"));

    // 切到 docs 页看导航
    await send('Page.navigate', { url: BASE + '/docs.html?f=STATUS.md' });
    await new Promise((r) => setTimeout(r, 2000));
    console.log('docs 导航:', await ev("[...document.querySelectorAll('header a')].map(a => a.textContent.trim()).join(' / ')"));

    await send('Page.navigate', { url: BASE + '/index.html' });
    await new Promise((r) => setTimeout(r, 1500));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/home.png', Buffer.from(shot.result.data, 'base64'));
    ws.close();
})();
