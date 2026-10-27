const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9469);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8229);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1200',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-sr3',
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

        console.log('状态栏:', await ev("document.getElementById('status').textContent"));
        console.log('状态规则条数:', await ev("stateRules.length"));
        console.log('目标状态可选:', await ev("stateIds.join(',')"));
        console.log('条件行数:', await ev("document.querySelectorAll('.srrow .cond').length"));
        console.log('下拉项数:', await ev("document.querySelector('.srrow .cond select').options.length"));
        console.log('规则卡片:', await ev("document.querySelectorAll('#list .rule').length"));

        // 改值 → 导出同步
        await ev(`
            (function(){
                var inp = document.querySelector('.srrow .cond input');
                inp.value = '4';
                inp.dispatchEvent(new Event('input'));
            })()
        `);
        console.log('改值后:', await ev("JSON.stringify(stateRules[0].when)"));
        console.log('导出含 policy:', await ev("/policy:\\n  stateRules/.test(toYaml()) ? '是' : '否'"));

        // 换旧键 → 新键，值保留
        await ev(`
            (function(){
                var sel = document.querySelector('.srrow .cond select');
                sel.value = 'hourLt';
                sel.dispatchEvent(new Event('change'));
            })()
        `);
        console.log('换键后:', await ev("JSON.stringify(stateRules[0].when)"), '(应保留 4)');

        // 添加 / 删除
        await ev(`
            (function(){
                var btn = [...document.querySelectorAll('.srule-card button')].find(b => /状态规则/.test(b.textContent) && b.textContent.length < 8);
                btn.click();
            })()
        `);
        console.log('加后:', await ev("stateRules.length"));
        await ev(`
            (function(){
                var rows = document.querySelectorAll('.srrow');
                var last = rows[rows.length - 1];
                [...last.querySelectorAll('.srhead button')].find(b => b.textContent === '×').click();
            })()
        `);
        console.log('删后:', await ev("stateRules.length"));

        // 撤销应能回退
        console.log('撤销可用:', await ev("!document.getElementById('undoBtn').disabled"));

        await ev("document.querySelector('#staterules').scrollIntoView({ block: 'start' })");
        await sleep(300);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/rules-staterules.png', Buffer.from(shot.result.data, 'base64'));
    } finally {
        chrome.kill();
    }
})();
