const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9564);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8313);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,860',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-rng2',
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

        console.log(await ev(`
            new Promise(function (resolve) {
                var dbg = window.PetDebug['deepseek-pet'];
                var p = dbg.player;
                var rows = [];
                var t0 = Date.now();
                dbg.director.sleep();
                var iv = setInterval(function () {
                    var v = document.querySelector('.dp-video.is-front');
                    var info = p.rangeInfo();
                    rows.push({
                        w: Math.round((Date.now() - t0) / 100) / 10,
                        t: v ? Math.round(v.currentTime * 100) / 100 : -1,
                        clip: v ? v.getAttribute('data-clip') : '-',
                        range: info
                    });
                    if (Date.now() - t0 > 9000) {
                        clearInterval(iv);
                        resolve(rows.filter(function (r, i) {
                            return i === 0 || Math.abs(r.t - rows[i - 1].t) > 0.4 || (r.range && r.range.hasTimer) !== (rows[i - 1].range && rows[i - 1].range.hasTimer);
                        }).map(function (r) { return JSON.stringify(r); }).join('\\n'));
                    }
                }, 150);
            })
        `));
    } finally {
        chrome.kill();
    }
})();
