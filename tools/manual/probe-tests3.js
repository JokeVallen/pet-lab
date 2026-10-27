const fs = require('fs');
const PORT = Number(process.argv[2] || 9422);
const BASE = 'http://127.0.0.1:' + (process.argv[3] || 8169);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const send = (m, p) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
    await new Promise((r) => ws.addEventListener('open', r));
    await send('Runtime.enable');
    await send('Page.enable');

    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) return 'EXC ' + (r.result.exceptionDetails.exception || {}).description;
        return r.result && r.result.result ? r.result.result.value : undefined;
    };

    await send('Page.navigate', { url: BASE + '/tests.html' });
    await sleep(2000);
    console.log('两栏:', await ev("getComputedStyle(document.querySelector('main')).gridTemplateColumns"));
    console.log('左栏套件卡:', await ev("document.querySelectorAll('main .col:first-child .suite').length"));
    console.log('右栏输出面板存在:', await ev("!!document.querySelector('.panel-col #out')"));
    const box = JSON.parse(await ev(`(function(){
        var a = document.querySelector('.col:first-child').getBoundingClientRect();
        var b = document.querySelector('.panel-col').getBoundingClientRect();
        return JSON.stringify({left: Math.round(a.left), right: Math.round(b.left), topA: Math.round(a.top), topB: Math.round(b.top)});
    })()`));
    console.log('左右位置:', JSON.stringify(box));

    await ev("document.querySelector('[data-run=\"levels\"]').click()");
    await sleep(3000);
    console.log('跑单套件后结果:', await ev("document.querySelector('#suite-levels .result').textContent"));
    console.log('输出可见:', await ev("document.getElementById('out').textContent.slice(0,40).replace(/\\n/g,' | ')"));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/tests.png', Buffer.from(shot.result.data, 'base64'));
    ws.close();
})();
