const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9427);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8175);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,1000',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-zs',
        `${BASE}/zone-editor.html`], { stdio: 'ignore' });

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
        await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', res); });
        ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
        await send('Runtime.enable');
        await send('Page.enable');
        await sleep(2500);

        // 新建一个自定义分区，设置父级与动作，然后保存
        await ev(`(function(){
            addZone();
            var i = zones.length - 1;
            zones[i].id = 'body.custom';
            zones[i].parent = 'body';
            zones[i].y0 = 0.6; zones[i].y1 = 0.7; zones[i].x0 = 0.2; zones[i].x1 = 0.4;
            reactions['body.custom'] = { act: 'click-happy', say: ['自定义分区的台词。'] };
            selected = i;
            draw();
        })()`);
        await sleep(300);
        console.log('保存前分区数:', await ev("zones.length"));
        await ev("saveZones()");
        await sleep(3000);
        console.log('保存状态:', await ev("document.getElementById('status').textContent"));
        console.log('预览含新分区:', await ev("document.getElementById('out').textContent.indexOf('body.custom') >= 0"));
    } finally {
        chrome.kill();
    }
})();
