const fs = require('fs');
const PORT = Number(process.argv[2] || 9446);
const BASE = 'http://127.0.0.1:' + (process.argv[3] || 8191);
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
    await send('Page.enable');
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) return 'EXC ' + (r.result.exceptionDetails.exception || {}).description;
        return r.result && r.result.result ? r.result.result.value : undefined;
    };

    await send('Page.navigate', { url: BASE + '/config-editor.html' });
    await sleep(3000);

    // 滚到「动作库」与「状态」，截两张
    await ev("document.querySelectorAll('.card')[4].scrollIntoView({block:'start'})");
    await sleep(400);
    let shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/config-anim.png', Buffer.from(shot.result.data, 'base64'));

    await ev("(function(){var c=[...document.querySelectorAll('.card')].find(x=>/状态/.test(x.querySelector('h2').textContent)); c.scrollIntoView({block:'start'});})()");
    await sleep(400);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/config-states.png', Buffer.from(shot.result.data, 'base64'));

    ws.close();
})();
