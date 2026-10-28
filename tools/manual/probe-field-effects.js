const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9571);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8321);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,860',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-fields',
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

        console.log('1) 对话标题:', await ev("(document.querySelector('.dp-chat-title')||document.querySelector('.dp-chat-head')||{}).textContent"));
        console.log('2) 角色指针样式 / is-no-drag:', await ev(`
            (function(){
                var root = document.querySelector('.dp-root');
                var ch = document.querySelector('.dp-character');
                return JSON.stringify({
                    noDrag: root.classList.contains('is-no-drag'),
                    cursor: getComputedStyle(ch).cursor,
                    dragEnabled: window.PetDebug['deepseek-pet'].config.drag.enabled
                });
            })()
        `));

        const geo = JSON.parse(await ev(`
            (function(){
                var r = document.querySelector('.dp-character').getBoundingClientRect();
                return JSON.stringify({ cx: Math.round(r.left + r.width/2), cy: Math.round(r.top + r.height*0.35), left: Math.round(r.left), top: Math.round(r.top) });
            })()
        `));

        // 拖拽：应该纹丝不动
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: geo.cx, y: geo.cy, button: 'left', clickCount: 1, buttons: 1 });
        for (let i = 1; i <= 4; i++) {
            await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: geo.cx - i * 20, y: geo.cy - i * 15, buttons: 1 });
            await sleep(60);
        }
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: geo.cx - 80, y: geo.cy - 60, button: 'left', clickCount: 1, buttons: 0 });
        await sleep(500);
        console.log('3) 拖后位置:', await ev(`
            (function(){
                var r = document.querySelector('.dp-root').getBoundingClientRect();
                return JSON.stringify({ left: Math.round(r.left), top: Math.round(r.top), moved: Math.abs(Math.round(r.left) - ${geo.left}) + Math.abs(Math.round(r.top) - ${geo.top}) });
            })()
        `));

        // 点击：应该还能摸摸，并且按配置飘 5 个粒子
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: geo.cx, y: geo.cy, button: 'left', clickCount: 1, buttons: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: geo.cx, y: geo.cy, button: 'left', clickCount: 1, buttons: 0 });
        await sleep(250);
        console.log('4) 点击后:', await ev(`
            JSON.stringify({
                particles: document.querySelectorAll('.dp-particle').length,
                act: window.PetDebug['deepseek-pet'].player.name()
            })
        `));

        // 气泡停留：发一条不带 ttl 的台词，量它挂了多久
        console.log('5) 气泡时长:', await ev(`
            new Promise(function(resolve){
                if (window.PetKernel) window.PetKernel.emit('speech.act', { text: '测试气泡', channel: 'auto', priority: 'ambient' });
                var bubble = document.querySelector('.dp-bubble');
                if (!bubble) return resolve('没有气泡节点');
                var t0 = Date.now();
                var iv = setInterval(function(){
                    if (!bubble.classList.contains('is-show')) { clearInterval(iv); resolve((Date.now() - t0) + 'ms'); }
                    if (Date.now() - t0 > 8000) { clearInterval(iv); resolve('超过 8s 还在'); }
                }, 50);
            })
        `));
    } finally {
        chrome.kill();
    }
})();
