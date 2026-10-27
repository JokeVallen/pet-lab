const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9543);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8293);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,860',
        '--autoplay-policy=no-user-gesture-required',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-ended',
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

        // 直接观察一次性动作的 ended 是否触发
        console.log(await ev(`
            new Promise(function (resolve) {
                var p = window.PetDebug['deepseek-pet'].player;
                var d = window.PetDebug['deepseek-pet'].director;
                var t0 = Date.now();
                var seen = null;
                var iv = setInterval(function () {
                    var v = document.querySelector('.dp-video.is-front');
                    if (!v) return;
                    if (!seen) { seen = v.getAttribute('data-clip') + '@' + v.duration + 's loop=' + v.loop + ' rate=' + v.playbackRate; }
                    if (p.name() === 'idle' && Date.now() - t0 > 300) { clearInterval(iv); resolve('回到待机，用时 ' + (Date.now() - t0) + 'ms | 起始: ' + seen); }
                    if (Date.now() - t0 > 8000) {
                        clearInterval(iv);
                        var v2 = document.querySelector('.dp-video.is-front');
                        resolve('8s 未回待机 | 当前: ' + p.name() + ' | 视频: ' + (v2 && v2.getAttribute('data-clip')) + ' t=' + (v2 && v2.currentTime.toFixed(2)) + '/' + (v2 && v2.duration) + ' ended=' + (v2 && v2.ended) + ' paused=' + (v2 && v2.paused) + ' | 起始: ' + seen);
                    }
                }, 100);
                d.cue('click-happy');
            })
        `));
    } finally {
        chrome.kill();
    }
})();
