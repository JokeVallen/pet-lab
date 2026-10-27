const fs = require('fs');
const PORT = Number(process.argv[2] || 9432);
const BASE = 'http://127.0.0.1:' + (process.argv[3] || 8179);
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
        if (r.result && r.result.exceptionDetails) return 'EXC';
        return r.result && r.result.result ? r.result.result.value : undefined;
    };
    const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, buttons: type === 'mouseReleased' ? 0 : 1 });

    await send('Page.navigate', { url: BASE + '/zone-editor.html' });
    await sleep(2500);

    const rect = JSON.parse(await ev(`(function(){
        var r = document.getElementById('stage').getBoundingClientRect();
        return JSON.stringify({l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height)});
    })()`));

    // 打开框选模式，画一个眼睛附近的矩形
    await ev("toggleDrawMode(true)");
    const ax = rect.l + Math.round(rect.w * 0.33), ay = rect.t + Math.round(rect.h * 0.22);
    const bx = rect.l + Math.round(rect.w * 0.47), by = rect.t + Math.round(rect.h * 0.29);
    await mouse('mousePressed', ax, ay);
    await sleep(80);
    await mouse('mouseMoved', bx, by);
    await sleep(120);
    await mouse('mouseReleased', bx, by);
    await sleep(400);

    console.log('新分区:', await ev("zones[zones.length-1].id"), '| 父级:', await ev("zones[zones.length-1].parent"));
    console.log('二维坐标:', await ev("JSON.stringify({x0:zones[zones.length-1].x0,x1:zones[zones.length-1].x1,y0:zones[zones.length-1].y0,y1:zones[zones.length-1].y1})"));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/zone.png', Buffer.from(shot.result.data, 'base64'));
    ws.close();
})();
