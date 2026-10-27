const fs = require('fs');
const PORT = Number(process.argv[2] || 9435);
const BASE = 'http://127.0.0.1:' + (process.argv[3] || 8182);
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
    const mouse = (type, x, y, extra) => send('Input.dispatchMouseEvent', Object.assign({
        type, x, y, button: 'left', clickCount: 1, buttons: type === 'mouseReleased' ? 0 : 1
    }, extra || {}));

    await send('Page.navigate', { url: BASE + '/zone-editor.html' });
    await sleep(2500);
    const rect = JSON.parse(await ev(`(function(){
        var r = document.getElementById('stage').getBoundingClientRect();
        return JSON.stringify({l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height)});
    })()`));

    // 双击建一个子分区，方便截图展示层级
    const cx = rect.l + Math.round(rect.w * 0.45), cy = rect.t + Math.round(rect.h * 0.35);
    await mouse('mousePressed', cx, cy); await mouse('mouseReleased', cx, cy);
    await sleep(40);
    await mouse('mousePressed', cx, cy, { clickCount: 2 }); await mouse('mouseReleased', cx, cy, { clickCount: 2 });
    await sleep(500);

    // 再框选一个
    await ev("toggleDrawMode(true)");
    const ax = rect.l + Math.round(rect.w * 0.55), ay = rect.t + Math.round(rect.h * 0.55);
    const bx = rect.l + Math.round(rect.w * 0.75), by = rect.t + Math.round(rect.h * 0.70);
    await mouse('mousePressed', ax, ay); await sleep(60); await mouse('mouseMoved', bx, by); await sleep(100); await mouse('mouseReleased', bx, by);
    await sleep(400);

    // 多选两个，展示选中色
    await ev("(function(){ selectedSet = new Set([0,2]); selected = 0; draw(); })()");
    await sleep(200);

    console.log('分区数:', await ev("zones.length"), '| 多选:', await ev("selectedSet.size"));
    console.log('键:', await ev("Object.keys(zones[0]).join(',')"));
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/zone.png', Buffer.from(shot.result.data, 'base64'));
    ws.close();
})();
