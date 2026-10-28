const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9560);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8310);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,860',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-range',
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

        // 记录 14 秒内的 currentTime 轨迹
        console.log(await ev(`
            new Promise(function (resolve) {
                var dbg = window.PetDebug['deepseek-pet'];
                var d = dbg.director;
                var t0 = Date.now();
                var log = [];
                d.sleep();
                var iv = setInterval(function () {
                    var v = document.querySelector('.dp-video.is-front');
                    var t = v ? v.currentTime : -1;
                    log.push([Math.round((Date.now() - t0) / 100) / 10, Math.round(t * 100) / 100, d.isSleeping()]);
                    if (Date.now() - t0 > 14000) {
                        clearInterval(iv);
                        // 压缩输出：连续相同值只留一个
                        var out = [];
                        for (var i = 0; i < log.length; i++) {
                            var cur = log[i];
                            var prev = out[out.length - 1];
                            if (!prev || Math.abs(cur[1] - prev[1]) > 0.15) out.push(cur);
                        }
                        var times = log.map(function (x) { return x[1]; }).filter(function (x) { return x >= 0; });
                        resolve(JSON.stringify({
                            轨迹: out,
                            最小时刻: Math.min.apply(null, times),
                            最大时刻: Math.max.apply(null, times),
                            仍在睡: d.isSleeping()
                        }, null, 1));
                    }
                }, 100);
            })
        `));
    } finally {
        chrome.kill();
    }
})();
