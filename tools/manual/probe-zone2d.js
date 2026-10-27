const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9431);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8178);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,1000',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-z3',
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

        // 进入框选模式，在头部区域画一个矩形
        await ev("toggleDrawMode(true)");
        await sleep(150);
        const ax = rect.l + Math.round(rect.w * 0.28), ay = rect.t + Math.round(rect.h * 0.16);
        const bx = rect.l + Math.round(rect.w * 0.52), by = rect.t + Math.round(rect.h * 0.30);
        await mouse('mousePressed', ax, ay);
        await sleep(80);
        await mouse('mouseMoved', bx, by);
        await sleep(120);
        console.log('橡皮筋出现:', await ev("!!document.querySelector('.band')"));
        await mouse('mouseReleased', bx, by);
        await sleep(250);
        console.log('分区数:', await ev("zones.length"));
        const z = JSON.parse(await ev("JSON.stringify(zones[zones.length-1])"));
        console.log('新分区:', JSON.stringify(z));
        console.log('自动父级:', z.parent || '(顶层)');
        console.log('框选模式已退出:', await ev("document.getElementById('stage').classList.contains('draw-mode')"));

        // 拖动移动（点在它中心）
        const cx = rect.l + Math.round(rect.w * (z.x0 + z.x1) / 2), cy = rect.t + Math.round(rect.h * (z.y0 + z.y1) / 2);
        await mouse('mousePressed', cx, cy);
        await sleep(80);
        await mouse('mouseMoved', cx + 30, cy + 25);
        await sleep(120);
        await mouse('mouseReleased', cx + 30, cy + 25);
        await sleep(200);
        const z2 = JSON.parse(await ev("JSON.stringify(zones[zones.length-1])"));
        console.log('移动 Δx:', (z2.x0 - z.x0).toFixed(2), 'Δy:', (z2.y0 - z.y0).toFixed(2), '| 尺寸不变:', (z2.x1 - z2.x0).toFixed(2) === (z.x1 - z.x0).toFixed(2));

        // 西侧手柄拉伸（左侧边中点）
        const wHandle = JSON.parse(await ev(`(function(){
            var e = document.querySelectorAll('.zone')[zones.length-1].getBoundingClientRect();
            return JSON.stringify({x: Math.round(e.left), y: Math.round(e.top + e.height/2)});
        })()`));
        await mouse('mousePressed', wHandle.x, wHandle.y);
        await sleep(80);
        await mouse('mouseMoved', wHandle.x - 25, wHandle.y);
        await sleep(120);
        await mouse('mouseReleased', wHandle.x - 25, wHandle.y);
        await sleep(200);
        const z3 = JSON.parse(await ev("JSON.stringify(zones[zones.length-1])"));
        console.log('左边界拉伸:', z3.x0.toFixed(2), '→ 宽度:', (z3.x1 - z3.x0).toFixed(2));

        console.log('YAML 尾部:', await ev("toYaml().split('\\n').slice(-7).join(' | ')"));
    } finally {
        chrome.kill();
    }
})();
