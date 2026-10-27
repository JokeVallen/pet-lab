const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9413);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8158);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-dg',
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
        var st = root && root.querySelector('.dp-stage');
        return JSON.stringify({
            pet: !!root,
            clip: front ? front.getAttribute('data-clip') : null,
            paused: front ? front.paused : null,
            t: front ? +front.currentTime.toFixed(2) : null,
            ready: st ? st.className : null,
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

        // 1) home → 点「宠物演示」卡片
        await send('Page.navigate', { url: BASE + '/home.html' });
        await sleep(1500);
        console.log('home 加载，宠物节点:', await ev("!!document.getElementById('deepseek-pet')"));

        await send('Page.navigate', { url: BASE + '/index.html' });
        await sleep(4000);
        console.log('演示页就绪:', await state());

        // 2) 找到宠物位置
        const box = JSON.parse(await ev(`(function(){
            var r = document.getElementById('deepseek-pet').getBoundingClientRect();
            return JSON.stringify({x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height*0.6)});
        })()`));
        console.log('宠物中心:', JSON.stringify(box));

        // 3) 按下并拖动
        await mouse('mouseMoved', box.x, box.y);
        await mouse('mousePressed', box.x, box.y);
        await sleep(120);
        console.log('按下 120ms:', await state());
        await sleep(600);
        console.log('按下 720ms:', await state());

        await mouse('mouseMoved', box.x + 60, box.y - 40);
        await sleep(300);
        console.log('拖动中:', await state());

        // 4) 松开
        await mouse('mouseReleased', box.x + 60, box.y - 40);
        await sleep(120);
        console.log('松开 120ms:', await state());
        await sleep(500);
        console.log('松开 620ms:', await state());
    } finally {
        chrome.kill();
    }
})();
