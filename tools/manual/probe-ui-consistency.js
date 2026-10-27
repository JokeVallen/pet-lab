const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9474);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8234);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1100',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-ui',
        `${BASE}/config-editor.html`], { stdio: 'ignore' });

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
        await send('Page.enable');
        await sleep(4000);

        // 统计所有可见的 input/select/textarea 的边框圆角和内边距，找不一致
        console.log('控件样式:', await ev(`
            (function(){
                var nodes = [...document.querySelectorAll('input:not([type=file]), select, textarea')];
                var seen = {};
                nodes.forEach(function (n) {
                    var s = getComputedStyle(n);
                    if (s.display === 'none') return;
                    var key = s.borderRadius + ' | ' + s.padding + ' | ' + s.borderTopWidth;
                    seen[key] = (seen[key] || 0) + 1;
                });
                return JSON.stringify(seen);
            })()
        `));
        console.log('状态规则卡片:', await ev("document.querySelectorAll('.srule-card').length"), '(配置页应为 0)');
        console.log('权重滑杆:', await ev("document.querySelectorAll('input[type=range]').length"));
    } finally {
        chrome.kill();
    }
})();
