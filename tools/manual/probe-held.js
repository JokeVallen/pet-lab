const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9544);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8294);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,860',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-held',
        BASE + '/demo.html'], { stdio: 'ignore' });

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
    const clip = () => ev("window.PetDebug['deepseek-pet'].player.name()");

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
        await sleep(6000);

        console.log('起始:', await clip());
        await ev("window.PetDebug['deepseek-pet'].director.hold('drag-up')");
        console.log('hold 后:', await clip());
        await sleep(2600);
        console.log('hold 2.6s（接悬空循环）:', await clip());
        await ev("window.PetDebug['deepseek-pet'].director.drop('drag-down')");
        console.log('drop 后:', await clip());
        await sleep(1500);
        console.log('drop 1.5s:', await clip());
        await sleep(2600);
        console.log('drop 4.1s（安全网应回待机）:', await clip());

        // 指针路径：先确认释放时 is-dragging 有没清掉
        const geo = JSON.parse(await ev(`
            (function(){
                var r = document.querySelector('.dp-character').getBoundingClientRect();
                return JSON.stringify({ cx: Math.round(r.left + r.width/2), cy: Math.round(r.top + r.height*0.35) });
            })()
        `));
        const dragging = () => ev("document.querySelector('.dp-root').classList.contains('is-dragging')");
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: geo.cx, y: geo.cy, button: 'left', clickCount: 1, buttons: 1 });
        console.log('按下:', await clip(), '| is-dragging:', await dragging());
        for (let i = 1; i <= 4; i++) {
            await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: geo.cx - i * 15, y: geo.cy - i * 12, buttons: 1 });
            await sleep(60);
        }
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: geo.cx - 60, y: geo.cy - 48, button: 'left', clickCount: 1, buttons: 0 });
        await sleep(300);
        console.log('释放后:', await clip(), '| is-dragging:', await dragging());
        await sleep(4200);
        console.log('释放 4.5s:', await clip());
    } finally {
        chrome.kill();
    }
})();
