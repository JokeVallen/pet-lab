const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9390);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8129);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-sh',
        `${BASE}/demo.html`], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const send = (m, p) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) return 'EXC ' + JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description);
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
        await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
        ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
        await send('Runtime.enable');
        await send('Page.enable');
        await sleep(3000);

        const probe = `(function(){
            var root = document.getElementById('deepseek-pet');
            var sh = root && root.querySelector('.dp-shadow');
            if (!sh) return 'no shadow element';
            var cs = getComputedStyle(sh);
            return JSON.stringify({
                vars: {
                    x: getComputedStyle(root).getPropertyValue('--dp-shadow-x').trim(),
                    y: getComputedStyle(root).getPropertyValue('--dp-shadow-y').trim(),
                    blur: getComputedStyle(root).getPropertyValue('--dp-shadow-blur').trim(),
                    color: getComputedStyle(root).getPropertyValue('--dp-shadow-color').trim()
                },
                transform: cs.transform,
                filter: cs.filter,
                bottom: cs.bottom,
                background: cs.backgroundColor,
                left: Math.round(sh.getBoundingClientRect().left),
                center: Math.round(sh.getBoundingClientRect().left + sh.getBoundingClientRect().width / 2)
            });
        })()`;

        console.log('改前:', await ev(probe));

        // 通过 CONFIG 热改：直接调用页面内的 applyShadow 不可见，这里改 CONFIG 后重建不是好办法
        // 改为直接在 root 上设置变量，验证 CSS 是否吃这些变量
        await ev("(function(){var r=document.getElementById('deepseek-pet'); r.style.setProperty('--dp-shadow-x','20px'); r.style.setProperty('--dp-shadow-y','2px'); r.style.setProperty('--dp-shadow-blur','30px'); r.style.setProperty('--dp-shadow-color','rgba(255,0,0,0.5)');})()");
        await sleep(300);
        console.log('改后:', await ev(probe));
    } finally {
        chrome.kill();
    }
})();
