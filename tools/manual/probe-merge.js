const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9487);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8245);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1200',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-mg',
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

        console.log('状态规则行:', await ev("document.querySelectorAll('#list .srrow').length"));
        console.log('状态条件控件:', await ev(`
            (function(){
                var row = document.querySelector('.srrow .cond');
                return JSON.stringify({
                    值控件: row.children[3].tagName + '/' + row.children[3].type,
                    子节点数: row.children.length,
                    下拉项: row.querySelector('select').options.length
                });
            })()
        `));
        console.log('情境规则条件控件:', await ev(`
            (function(){
                var cards = [...document.querySelectorAll('#list > .rule')].filter(c => !c.classList.contains('srule-card'));
                var row = cards[0].querySelector('.cond');
                return JSON.stringify({
                    值控件: row.children[3].tagName + '/' + row.children[3].type,
                    子节点数: row.children.length,
                    下拉项: row.querySelector('select').options.length
                });
            })()
        `));
        console.log('布尔条件(暗色):', await ev(`
            (function(){
                var cards = [...document.querySelectorAll('#list > .rule')].filter(c => !c.classList.contains('srule-card'));
                for (var i = 0; i < cards.length; i++) {
                    var rows = cards[i].querySelectorAll('.cond');
                    for (var j = 0; j < rows.length; j++) {
                        var v = rows[j].children[3];
                        if (v && v.tagName === 'SELECT') return rows[j].querySelector('select').value + ' → 值控件 select，选项 ' + [...v.options].map(o=>o.textContent).join('/');
                    }
                }
                return '没找到布尔条件';
            })()
        `));

        // 情境规则里改值（数字）
        console.log('情境规则改值前:', await ev("JSON.stringify(rules[2].when)"));
        await ev(`
            (function(){
                var cards = [...document.querySelectorAll('#list > .rule')].filter(c => !c.classList.contains('srule-card'));
                var row = cards[2].querySelector('.cond');
                var v = row.children[3];
                v.value = '0.9';
                v.dispatchEvent(new Event('input'));
            })()
        `);
        console.log('情境规则改值后:', await ev("JSON.stringify(rules[2].when)"));

        // 状态规则里换键
        console.log('状态规则换键前:', await ev("JSON.stringify(stateRules[2].when)"));
        await ev(`
            (function(){
                var row = document.querySelectorAll('.srrow')[2].querySelectorAll('.cond')[2];
                var sel = row.querySelector('select');
                sel.value = 'scrollLte';
                sel.dispatchEvent(new Event('change'));
            })()
        `);
        console.log('状态规则换键后:', await ev("JSON.stringify(stateRules[2].when)"), '(值应保留 0.92)');

        // 两边都能用自定义
        console.log('状态规则自定义:', await ev(`
            (function(){
                var row = document.querySelectorAll('.srrow')[0].querySelector('.cond');
                var sel = row.querySelector('select');
                sel.value = '__custom';
                sel.dispatchEvent(new Event('change'));
                var k = row.querySelector('.keyin');
                k.value = 'srCustom';
                k.dispatchEvent(new Event('change'));
                return JSON.stringify(stateRules[0].when) + ' 警告=' + (document.querySelector('.srrow .condwarn').style.display !== 'none');
            })()
        `));
        console.log('情境规则自定义:', await ev(`
            (function(){
                var cards = [...document.querySelectorAll('#list > .rule')].filter(c => !c.classList.contains('srule-card'));
                var row = cards[0].querySelector('.cond');
                var sel = row.querySelector('select');
                sel.value = '__custom';
                sel.dispatchEvent(new Event('change'));
                var k = row.querySelector('.keyin');
                k.value = 'rCustom';
                k.dispatchEvent(new Event('change'));
                return JSON.stringify(rules[0].when);
            })()
        `));

        await ev("window.scrollTo(0, 0)");
        await sleep(200);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/rules-merged.png', Buffer.from(shot.result.data, 'base64'));
        console.log('截图字节:', Buffer.from(shot.result.data, 'base64').length);
    } finally {
        chrome.kill();
    }
})();
