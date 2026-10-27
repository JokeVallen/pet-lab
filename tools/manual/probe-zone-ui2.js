const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9434);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8181);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1100',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-z6',
        `${BASE}/zone-editor.html`], { stdio: 'ignore' });

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
    const mouse = (type, x, y, extra) => send('Input.dispatchMouseEvent', Object.assign({
        type, x, y, button: 'left', clickCount: 1, buttons: type === 'mouseReleased' ? 0 : 1
    }, extra || {}));

    const doubleClick = async (x, y) => {
        await mouse('mousePressed', x, y, { clickCount: 1 });
        await mouse('mouseReleased', x, y, { clickCount: 1 });
        await sleep(40);
        await mouse('mousePressed', x, y, { clickCount: 2 });
        await mouse('mouseReleased', x, y, { clickCount: 2 });
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
        await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', res); });
        ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
        await send('Runtime.enable');
        await send('Page.enable');
        await sleep(2500);

        const rect = JSON.parse(await ev(`(function(){
            var r = document.getElementById('stage').getBoundingClientRect();
            return JSON.stringify({l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height)});
        })()`));

        const before = Number(await ev("zones.length"));
        // 双击头部（y≈0.10 → head.crown 区域）
        const cx = rect.l + Math.round(rect.w * 0.5), cy = rect.t + Math.round(rect.h * 0.10);
        await doubleClick(cx, cy);
        await sleep(500);
        console.log('双击后数量:', before, '→', await ev("zones.length"));
        console.log('新分区:', await ev("JSON.stringify(zones[zones.length-1])"));

        // 双击身体（不同父级）
        const bx = rect.l + Math.round(rect.w * 0.5), by = rect.t + Math.round(rect.h * 0.65);
        await doubleClick(bx, by);
        await sleep(500);
        console.log('身体双击父级:', await ev("zones[zones.length-1].parent"));

        // Shift 多选 + Del
        await ev("(function(){ selectedSet = new Set([zones.length-1]); draw(); })()");
        const p2 = JSON.parse(await ev(`(function(){
            var e = document.querySelectorAll('.zone')[1].getBoundingClientRect();
            return JSON.stringify({x: Math.round(e.left + e.width/2), y: Math.round(e.top + e.height/2)});
        })()`));
        await mouse('mousePressed', p2.x, p2.y, { modifiers: 8 });
        await mouse('mouseReleased', p2.x, p2.y, { modifiers: 8 });
        await sleep(200);
        console.log('多选:', await ev("selectedSet.size"));
        const n2 = Number(await ev("zones.length"));
        await ev("document.dispatchEvent(new KeyboardEvent('keydown', {key:'Delete'}))");
        await sleep(300);
        console.log('Del:', n2, '→', await ev("zones.length"));
    } finally {
        chrome.kill();
    }
})();
