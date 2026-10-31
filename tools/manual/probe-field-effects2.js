const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9572);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8322);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,860',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-fields2',
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

        const cfg = JSON.parse(await ev(`JSON.stringify({
            title: (document.querySelector('.dp-chat-title') || {}).textContent,
            name: window.PetDebug['deepseek-pet'].config.persona.name,
            drag: window.PetDebug['deepseek-pet'].config.drag,
            particles: window.PetDebug['deepseek-pet'].config.click.particleCount,
            bubbleTtl: window.PetDebug['deepseek-pet'].config.speech.bubbleTtl
        })`));
        console.log('配置:', JSON.stringify(cfg));

        const geo = JSON.parse(await ev(`
            (function(){
                var r = document.querySelector('.dp-character').getBoundingClientRect();
                return JSON.stringify({ cx: Math.round(r.left + r.width/2), cy: Math.round(r.top + r.height*0.35), left: Math.round(r.left), top: Math.round(r.top) });
            })()
        `));

        // 拖拽
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: geo.cx, y: geo.cy, button: 'left', clickCount: 1, buttons: 1 });
        for (let i = 1; i <= 4; i++) {
            await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: geo.cx - i * 20, y: geo.cy - i * 15, buttons: 1 });
            await sleep(60);
        }
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: geo.cx - 80, y: geo.cy - 60, button: 'left', clickCount: 1, buttons: 0 });
        await sleep(600);
        const after = JSON.parse(await ev(`
            (function(){
                var r = document.querySelector('.dp-root').getBoundingClientRect();
                return JSON.stringify({ left: Math.round(r.left), top: Math.round(r.top) });
            })()
        `));
        console.log('拖拽位移:', Math.abs(after.left - geo.left) + Math.abs(after.top - geo.top), 'px');

        // 清掉残留粒子，再点一次
        await ev("document.querySelectorAll('.dp-particle').forEach(function(p){ p.remove(); })");
        await sleep(200);
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: geo.cx, y: geo.cy, button: 'left', clickCount: 1, buttons: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: geo.cx, y: geo.cy, button: 'left', clickCount: 1, buttons: 0 });
        await sleep(200);
        console.log('点击粒子数:', await ev("document.querySelectorAll('.dp-particle').length"));

        // 气泡：从真正显示那一刻开始计时
        console.log('气泡停留:', await ev(`
            new Promise(function(resolve){
                var bubble = document.querySelector('.dp-bubble');
                if (!bubble) return resolve('没有气泡节点');
                if (window.PetKernel) window.PetKernel.emit('speech.act', { text: '气泡计时', channel: 'auto', priority: 'ambient' });
                var shown = 0, t0 = 0;
                var iv = setInterval(function(){
                    var on = bubble.classList.contains('is-show');
                    if (on && !shown) { shown = 1; t0 = Date.now(); }
                    if (shown && !on) { clearInterval(iv); resolve((Date.now() - t0) + 'ms'); }
                    if (Date.now() - t0 > 9000) { clearInterval(iv); resolve('超时'); }
                }, 20);
            })
        `));
    } finally {
        chrome.kill();
    }
})();
