const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9414);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8159);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-dg2',
        `${BASE}/home.html`], { stdio: 'ignore' });

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

    const state = () => ev(`(function(){
        var root = document.getElementById('deepseek-pet');
        var front = root && root.querySelector('.dp-video.is-front');
        var vs = root ? [].slice.call(root.querySelectorAll('.dp-video')).map(function(v){
            return (v.getAttribute('data-clip')||'-') + (v.paused?'(p)':'(play)');
        }).join(',') : null;
        return JSON.stringify({
            clip: front ? front.getAttribute('data-clip') : null,
            paused: front ? front.paused : null,
            t: front ? +front.currentTime.toFixed(2) : null,
            vs: vs,
            dragging: root ? root.classList.contains('is-dragging') : null
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

        await send('Page.navigate', { url: BASE + '/home.html' });
        await sleep(1200);

        // 用户的做法：点卡片进入演示页
        const card = JSON.parse(await ev(`(function(){
            var a = document.querySelector('a.card[href="index.html"]');
            var r = a.getBoundingClientRect();
            return JSON.stringify({x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2)});
        })()`));
        await mouse('mousePressed', card.x, card.y);
        await mouse('mouseReleased', card.x, card.y);
        await sleep(4000);
        console.log('演示页（点卡片进入）:', await ev('location.pathname'), '|', await state());

        const box = JSON.parse(await ev(`(function(){
            var r = document.getElementById('deepseek-pet').getBoundingClientRect();
            return JSON.stringify({x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height*0.6)});
        })()`));
        console.log('宠物位置:', JSON.stringify(box));

        await mouse('mouseMoved', box.x, box.y);
        await mouse('mousePressed', box.x, box.y);
        await sleep(150);
        console.log('按下 150ms:', await state());
        await sleep(500);
        await mouse('mouseMoved', box.x + 50, box.y - 30);
        await sleep(250);
        console.log('拖动中:', await state());
        await mouse('mouseReleased', box.x + 50, box.y - 30);
        await sleep(150);
        console.log('松开 150ms:', await state());

        // 再走一次：演示页 → 回退 → 再进
        await send('Runtime.evaluate', { expression: 'history.back()' });
        await sleep(1500);
        console.log('回退后页面:', await ev('location.pathname'), '| 宠物:', await ev("!!document.getElementById('deepseek-pet')"));
        await send('Runtime.evaluate', { expression: 'history.forward()' });
        await sleep(3000);
        console.log('前进后页面:', await ev('location.pathname'), '|', await state());
    } finally {
        chrome.kill();
    }
})();
