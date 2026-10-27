const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9464);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8224);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1200',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-sr2',
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

        const CARD = "window.__card";
        await ev(`window.__card = [...document.querySelectorAll('.card')].find(x => /状态规则/.test(x.querySelector('h2').textContent))`);

        console.log('元数据:', await ev("WHEN_META.length + ' 项，旧键 ' + WHEN_META.filter(m=>m.legacy).length"));
        console.log('规则行:', await ev(`${CARD}.querySelectorAll('.srule').length`));
        console.log('条件行:', await ev(`${CARD}.querySelectorAll('.cond').length`));

        // 旧键换新键，值应保留
        console.log('换键前:', await ev("JSON.stringify(cfg.policy.stateRules[0])"));
        await ev(`
            (function(){
                var sel = window.__card.querySelectorAll('.srule')[0].querySelector('.cond select');
                sel.value = 'hourLt';
                sel.dispatchEvent(new Event('change'));
            })()
        `);
        console.log('换键后:', await ev("JSON.stringify(cfg.policy.stateRules[0])"), '(值应仍是 6)');

        // 添加一条
        await ev(`
            (function(){
                var btn = [...window.__card.querySelectorAll('button')].find(b => /状态规则/.test(b.textContent) && b.textContent.length < 8);
                btn.click();
            })()
        `);
        await sleep(200);
        console.log('加后条数:', await ev("cfg.policy.stateRules.length"), '最后一条:', await ev("JSON.stringify(cfg.policy.stateRules[cfg.policy.stateRules.length-1])"));

        // 删除最后一条
        await ev(`
            (function(){
                var rows = window.__card.querySelectorAll('.srule');
                var last = rows[rows.length - 1];
                [...last.querySelectorAll('.srule-head button')].find(b => b.textContent === '×').click();
            })()
        `);
        await sleep(200);
        console.log('删后条数:', await ev("cfg.policy.stateRules.length"));

        await ev("window.__card.scrollIntoView({ block: 'start' })");
        await sleep(300);
        const box = JSON.parse(await ev(`
            (function(){
                var c = window.__card.getBoundingClientRect();
                return JSON.stringify({ x: Math.round(c.left), y: Math.round(c.top + window.scrollY), w: Math.round(c.width), h: Math.min(480, Math.round(c.height)) });
            })()
        `));
        const shot = await send('Page.captureScreenshot', {
            format: 'png',
            clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 2 },
            captureBeyondViewport: true
        });
        fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/config-staterules.png', Buffer.from(shot.result.data, 'base64'));
    } finally {
        chrome.kill();
    }
})();
