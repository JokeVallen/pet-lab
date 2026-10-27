const fs = require('fs');
const PORT = Number(process.argv[2] || 9439);
const BASE = 'http://127.0.0.1:' + (process.argv[3] || 8128);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const send = (m, p) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
    await new Promise((r) => ws.addEventListener('open', r));
    await send('Runtime.enable');
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) return 'EXC ' + (r.result.exceptionDetails.exception || {}).description;
        return r.result && r.result.result ? r.result.result.value : undefined;
    };

    const probe = `(async () => {
        const Z = (await import('/js/pet/modules/zones.js')).PetZones;
        const cfg = (await import('/js/pet/config.js')).default;
        const e = Z.createZones({ zones: cfg.zones, map: cfg.zoneReactions, fallback: 'body' });
        return JSON.stringify({
            keys: Object.keys(cfg.zones[0]),
            head: e.hit(0.1, 0.5),
            cheek: e.hit(0.2, 0.5),
            belly: e.hit(0.7, 0.5),
            fin: e.hit(0.65, 0.15),
            tail: e.hit(0.93, 0.5)
        });
    })()`;

    console.log('博客运行时命中:', await ev(probe));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/blog.png', Buffer.from(shot.result.data, 'base64'));
    ws.close();
})();
