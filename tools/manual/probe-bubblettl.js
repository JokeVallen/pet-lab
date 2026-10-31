const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9573);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8323);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,860',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-bub',
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

        console.log('气泡停留:', await ev(`
            new Promise(function(resolve){
                var bubble = document.querySelector('.dp-bubble');
                // 先等当前气泡消失，避免拿上一句话的余量
                var wait = setInterval(function(){
                    if (!bubble.classList.contains('is-show')) {
                        clearInterval(wait);
                        if (window.PetKernel) window.PetKernel.emit('speech.act', { text: '气泡计时', channel: 'auto', priority: 'ambient' });
                        var shown = 0, t0 = 0;
                        var iv = setInterval(function(){
                            var on = bubble.classList.contains('is-show');
                            if (on && !shown) { shown = 1; t0 = Date.now(); }
                            if (shown && !on) { clearInterval(iv); resolve((Date.now() - t0) + 'ms'); }
                            if (t0 && Date.now() - t0 > 9000) { clearInterval(iv); resolve('超时'); }
                        }, 20);
                    }
                }, 50);
            })
        `));
    } finally {
        chrome.kill();
    }
})();
