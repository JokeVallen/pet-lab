const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9415);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8160);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-dg3',
        `${BASE}/index.html`], { stdio: 'ignore' });

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

    const vids = () => ev(`(function(){
        var root = document.getElementById('deepseek-pet');
        if (!root) return 'no pet';
        return [].slice.call(root.querySelectorAll('.dp-video')).map(function(v){
            var cs = getComputedStyle(v);
            return {
                clip: v.getAttribute('data-clip') || '-',
                paused: v.paused,
                t: +v.currentTime.toFixed(2),
                readyState: v.readyState,
                op: cs.opacity,
                front: v.classList.contains('is-front'),
                w: Math.round(v.getBoundingClientRect().width),
                h: Math.round(v.getBoundingClientRect().height),
                hasSrc: !!v.currentSrc
            };
        });
    })()`);

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
        await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
        ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
        await send('Runtime.enable');
        await send('Page.enable');
        await sleep(4200);

        console.log('=== 就绪 ===');
        console.log(JSON.stringify(await vids(), null, 1));

        const box = JSON.parse(await ev(`(function(){
            var r = document.getElementById('deepseek-pet').getBoundingClientRect();
            return JSON.stringify({x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height*0.6), w: Math.round(r.width), h: Math.round(r.height)});
        })()`));
        console.log('宠物盒:', JSON.stringify(box));

        await mouse('mouseMoved', box.x, box.y);
        await mouse('mousePressed', box.x, box.y);
        await sleep(200);
        console.log('=== 按下 200ms ===');
        console.log(JSON.stringify(await vids(), null, 1));
    } finally {
        chrome.kill();
    }
})();
