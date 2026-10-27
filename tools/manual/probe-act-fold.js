const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9478);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8221);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1100',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-a4',
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

        const stat = () => ev(`
            (function(){
                return JSON.stringify({
                    规则: document.querySelectorAll('.rule').length,
                    芯片: document.querySelectorAll('.acts .chip').length,
                    展开: document.querySelectorAll('.acts').length,
                    摘要: [...document.querySelectorAll('.actprev')].slice(0, 4).map(e => e.textContent).join(' | ')
                });
            })()
        `);

        console.log('初始:', await stat());

        await ev(`
            (function(){
                var rule = rules.find(r => Array.isArray(r.act));
                var idx = rules.indexOf(rule);
                document.querySelectorAll('.rule')[idx].querySelector('.acthead button').click();
            })()
        `);
        await sleep(300);
        console.log('展开一条:', await stat());

        console.log('点芯片前:', await ev("JSON.stringify(rules.find(r=>Array.isArray(r.act)).act)"));
        await ev(`
            (function(){
                var rule = rules.find(r => Array.isArray(r.act));
                var idx = rules.indexOf(rule);
                var card = document.querySelectorAll('.rule')[idx];
                var chip = [...card.querySelectorAll('.acts .chip')].find(c => c.textContent === 'angry');
                chip.click();
            })()
        `);
        console.log('点芯片后:', await ev("JSON.stringify(rules.find(r=>Array.isArray(r.act)).act)"));
        console.log('摘要同步:', await ev("document.querySelector('.actprev').textContent"));

        // 换一条展开，前一条应自动收起
        await ev(`
            (function(){
                var cards = document.querySelectorAll('.rule');
                cards[0].querySelector('.acthead button').click();
            })()
        `);
        await sleep(200);
        console.log('换一条后:', await stat());

        await ev(`
            (function(){
                var open = document.querySelector('.rule .acts');
                var card = open ? open.closest('.rule') : document.querySelector('.rule');
                card.scrollIntoView({ block: 'start' });
                window.scrollBy(0, -20);
            })()
        `);
        await sleep(300);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/rules-act-fold.png', Buffer.from(shot.result.data, 'base64'));
    } finally {
        chrome.kill();
    }
})();
