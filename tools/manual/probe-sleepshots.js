const { spawn } = require('child_process');
const fs = require('fs');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9561);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8311);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,860',
        '--force-device-scale-factor=2',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-shots',
        BASE + '/index.html'], { stdio: 'ignore' });

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
    const shot = async (file) => {
        const r = await send('Page.captureScreenshot', { format: 'png', clip: null });
        fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
    };
    const clipRect = async (file) => {
        const box = JSON.parse(await ev(`
            (function(){
                var r = document.querySelector('.dp-root').getBoundingClientRect();
                return JSON.stringify({x: Math.max(0, r.left-10), y: Math.max(0, r.top-10), width: r.width+20, height: r.height+20, scale: 2});
            })()
        `));
        const r = await send('Page.captureScreenshot', { format: 'png', clip: box });
        fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
    };
    const state = () => ev(`
        (function(){
            var dbg = window.PetDebug['deepseek-pet'];
            var v = document.querySelector('.dp-video.is-front');
            return JSON.stringify({ 睡: dbg.director.isSleeping(), 动作: dbg.player.name(), t: v ? Math.round(v.currentTime*100)/100 : -1 });
        })()
    `);

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
        await send('Page.enable');
        await sleep(6000);

        await ev("window.PetDebug['deepseek-pet'].director.sleep()");

        // 进入睡眠过程：2s（打瞌睡）和 4.3s（快躺下）
        await sleep(2000);
        console.log('intro 2.0s:', await state());
        await clipRect('docs/screenshots/sleep-intro.png');
        await sleep(2300);
        console.log('intro 4.3s:', await state());

        // 等到循环段中间
        await sleep(1800);
        console.log('loop 中:', await state());
        await clipRect('docs/screenshots/sleep-loop.png');

        // 循环接缝前后各抓一张
        await ev(`
            new Promise(function(res){ 
                var v = document.querySelector('.dp-video.is-front');
                var iv = setInterval(function(){
                    if (v.currentTime > 6.6) { clearInterval(iv); res(1); }
                }, 16);
            })
        `);
        console.log('接缝前:', await state());
        await clipRect('docs/screenshots/sleep-seam-before.png');
        await sleep(400);
        console.log('接缝后:', await state());
        await clipRect('docs/screenshots/sleep-seam-after.png');

        // 点一下唤醒
        const geo = JSON.parse(await ev(`
            (function(){
                var r = document.querySelector('.dp-character').getBoundingClientRect();
                return JSON.stringify({ cx: Math.round(r.left + r.width/2), cy: Math.round(r.top + r.height*0.35) });
            })()
        `));
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: geo.cx, y: geo.cy, button: 'left', clickCount: 1, buttons: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: geo.cx, y: geo.cy, button: 'left', clickCount: 1, buttons: 0 });
        await sleep(800);
        console.log('点击后:', await state());

        // 再睡一次，确认区间循环还能重新进入
        await ev("window.PetDebug['deepseek-pet'].director.sleep()");
        await sleep(7000);
        console.log('二次入睡 7s:', await state());
    } finally {
        chrome.kill();
    }
})();
