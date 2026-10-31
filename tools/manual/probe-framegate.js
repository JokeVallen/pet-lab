const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9417);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8162);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-fg',
        `${BASE}/index.html`], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const send = (m, p) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
        if (r.result && r.result.exceptionDetails) {
            const d = r.result.exceptionDetails.exception;
            return 'EXC ' + (d && d.description ? d.description.split('\n')[0] : '');
        }
        return r.result && r.result.result ? r.result.result.value : undefined;
    };
    const mouse = (type, x, y, extra) => send('Input.dispatchMouseEvent', Object.assign({
        type, x, y, button: 'left', clickCount: 1, buttons: type === 'mouseReleased' ? 0 : 1
    }, extra || {}));

    const look = () => ev(`(function(){
        var root = document.getElementById('deepseek-pet');
        if (!root) return 'no pet';
        var st = root.querySelector('.dp-stage');
        var front = root.querySelector('.dp-video.is-front');
        var art = root.querySelector('.dp-art');
        return JSON.stringify({
            clip: front ? front.getAttribute('data-clip') : null,
            t: front ? +front.currentTime.toFixed(2) : null,
            static: st.classList.contains('is-static'),
            artOpacity: art ? getComputedStyle(art).opacity : null
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

        // 走用户路径：home → 点卡片
        await send('Page.navigate', { url: BASE + '/index.html' });
        await sleep(1200);
        const card = JSON.parse(await ev(`(function(){
            var a = document.querySelector('a.card[href="demo.html"]');
            var r = a.getBoundingClientRect();
            return JSON.stringify({x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2)});
        })()`));
        await mouse('mousePressed', card.x, card.y);
        await mouse('mouseReleased', card.x, card.y);
        await sleep(3000);
        console.log('就绪:', await look());

        const box = JSON.parse(await ev(`(function(){
            var r = document.getElementById('deepseek-pet').getBoundingClientRect();
            return JSON.stringify({x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height*0.6)});
        })()`));

        // 关键：采样按下后前 500ms 内静帧是否一直保持（不提前让位）
        await mouse('mouseMoved', box.x, box.y);
        await mouse('mousePressed', box.x, box.y);
        for (const ms of [40, 120, 250, 450]) {
            await sleep(ms === 40 ? 40 : 80);
            console.log('按下 ' + ms + 'ms:', await look());
        }
        await mouse('mouseMoved', box.x + 50, box.y - 30);
        await sleep(300);
        console.log('拖动中:', await look());
        await mouse('mouseReleased', box.x + 50, box.y - 30);
        await sleep(400);
        console.log('松开:', await look());
    } finally {
        chrome.kill();
    }
})();
