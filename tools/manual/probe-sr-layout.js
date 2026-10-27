const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9471);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8231);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1200',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-sr4',
        `${BASE}/rules-editor.html`], { stdio: 'ignore' });

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
        await sleep(3500);

        console.log('状态规则条:', await ev("document.querySelectorAll('.srrow').length"));
        console.log('布局列宽:', await ev(`
            (function(){
                var m = document.querySelector('main');
                var l = document.getElementById('list');
                var a = document.querySelector('aside');
                var sr = document.querySelector('.srwrap');
                var r0 = document.querySelectorAll('#list > .rule')[0];
                var g = getComputedStyle(m).gridTemplateColumns;
                return JSON.stringify({
                    mainCols: g,
                    listWidth: Math.round(l.getBoundingClientRect().width),
                    asideLeft: Math.round(a.getBoundingClientRect().left),
                    srWidth: sr ? Math.round(sr.getBoundingClientRect().width) : null,
                    ruleLeft: r0 ? Math.round(r0.getBoundingClientRect().left) : null,
                    srLeft: sr ? Math.round(sr.getBoundingClientRect().left) : null
                });
            })()
        `));

        await ev("window.scrollTo(0, 0)");
        await sleep(200);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/rules-staterules.png', Buffer.from(shot.result.data, 'base64'));
        console.log('截图字节:', Buffer.from(shot.result.data, 'base64').length);
    } finally {
        chrome.kill();
    }
})();
