const fs = require('fs');
const PORT = Number(process.argv[2] || 9412);
const BASE = 'http://127.0.0.1:' + (process.argv[3] || 8157);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const send = (m, p) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
    ws.addEventListener('message', (e) => {
        const m = JSON.parse(e.data);
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    });
    await new Promise((r) => ws.addEventListener('open', r));
    await send('Runtime.enable');
    await send('Page.enable');

    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
        if (r.result && r.result.exceptionDetails) return 'EXC ' + (r.result.exceptionDetails.exception || {}).description;
        return r.result && r.result.result ? r.result.result.value : undefined;
    };

    console.log('套件卡片数:', await ev("document.querySelectorAll('.suite').length"));
    console.log('单元组:', await ev("[...document.querySelectorAll('#unitList .suite .name')].map(n=>n.textContent).join(' / ')"));
    console.log('端到端组:', await ev("[...document.querySelectorAll('#e2eList .suite .name')].map(n=>n.textContent).join(' / ')"));

    // 单跑一个套件
    await ev("document.querySelector('[data-run=\"zones\"]').click()");
    await sleep(3500);
    console.log('zones 结果:', await ev("document.querySelector('#suite-zones .result').textContent"));
    console.log('总计:', await ev("document.getElementById('tally').textContent"));

    // 一键跑全部单元
    await ev("document.getElementById('runUnit').click()");
    await sleep(9000);
    console.log('全部单元 → 徽章:', await ev("document.getElementById('badge').textContent"));
    console.log('全部单元 → 通过:', await ev("document.getElementById('tally').textContent"));
    console.log('各自结果:', await ev("[...document.querySelectorAll('#unitList .suite .result')].map(r=>r.textContent.split('·')[0].trim()).join(' | ')"));
    console.log('总耗时:', await ev("document.getElementById('duration').textContent"));

    // hover 检查：primary 按钮不变色
    const btn = await ev("JSON.stringify((function(){var b=document.getElementById('runUnit');var s=getComputedStyle(b);return {bg:s.backgroundColor,hasHoverRule:!![...document.styleSheets[0].cssRules].find(r=>r.selectorText&&r.selectorText.indexOf('not(.primary)')>=0)};})())");
    console.log('主按钮样式:', btn);

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/tests.png', Buffer.from(shot.result.data, 'base64'));
    ws.close();
})();
