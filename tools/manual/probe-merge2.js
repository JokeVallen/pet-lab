const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9488);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8246);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1200',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-mg2',
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

        // 状态规则：＋ 条件
        console.log('状态规则加条件前:', await ev("JSON.stringify(stateRules[0].when)"));
        await ev(`
            (function(){
                var row = document.querySelectorAll('.srrow')[0];
                [...row.querySelectorAll('button')].find(b => /条件/.test(b.textContent) && !/状态规则/.test(b.textContent)).click();
            })()
        `);
        console.log('状态规则加条件后:', await ev("JSON.stringify(stateRules[0].when)"), '(新键默认值应为 0)');

        // 情境规则：＋ 条件
        console.log('情境加条件前:', await ev("JSON.stringify(rules[0].when)"));
        await ev(`
            (function(){
                var cards = [...document.querySelectorAll('#list > .rule')].filter(c => !c.classList.contains('srule-card'));
                [...cards[0].querySelectorAll('button')].find(b => b.textContent === '＋ 条件').click();
            })()
        `);
        console.log('情境加条件后:', await ev("JSON.stringify(rules[0].when)"));

        // 删除条件（两处）
        await ev(`
            (function(){
                var cards = [...document.querySelectorAll('#list > .rule')].filter(c => !c.classList.contains('srule-card'));
                var rows = cards[0].querySelectorAll('.cond');
                rows[rows.length - 1].querySelector('button.x').click();
            })()
        `);
        console.log('情境删条件后:', await ev("JSON.stringify(rules[0].when)"));

        // 撤销
        await ev("undo()");
        console.log('撤销后:', await ev("JSON.stringify(rules[0].when)"));

        // 别名选项在情境规则里也能选
        console.log('情境规则别名可选:', await ev(`
            (function(){
                var cards = [...document.querySelectorAll('#list > .rule')].filter(c => !c.classList.contains('srule-card'));
                var sel = cards[2].querySelectorAll('.cond')[1].querySelector('select');
                return [...sel.options].filter(o => /（旧）/.test(o.textContent)).map(o => o.value).join(',');
            })()
        `));
        console.log('切到别名:', await ev(`
            (function(){
                var cards = [...document.querySelectorAll('#list > .rule')].filter(c => !c.classList.contains('srule-card'));
                var row = cards[2].querySelectorAll('.cond')[1];
                var sel = row.querySelector('select');
                var before = JSON.stringify(rules[2].when);
                sel.value = 'hourBelow';
                sel.dispatchEvent(new Event('change'));
                return before + ' → ' + JSON.stringify(rules[2].when);
            })()
        `), '(别名应被归一化成 hourLt)');

        await ev("window.scrollTo(0, 0)");
        await sleep(200);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/rules-merged.png', Buffer.from(shot.result.data, 'base64'));
    } finally {
        chrome.kill();
    }
})();
