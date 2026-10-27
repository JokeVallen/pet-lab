const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9452);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8197);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1100',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-s2',
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
        await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', res); });
        ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
        await send('Runtime.enable');
        await send('Page.enable');
        await sleep(3000);

        const weights = () => ev("JSON.stringify(Object.fromEntries(Object.entries(cfg.states).map(([k,v])=>[k, v.weight])))");
        console.log('初始 states 权重:', await weights());
        console.log('policy 未被污染:', await ev("JSON.stringify(cfg.policy.rollWeights)"));

        await ev(`
            (function(){
                var card = [...document.querySelectorAll('.card')].find(x => /状态/.test(x.querySelector('h2').textContent));
                [...card.querySelectorAll('button')].find(b => /添加状态/.test(b.textContent)).click();
            })()
        `);
        await sleep(300);
        console.log('添加后权重:', await weights());
        console.log('按钮数:', await ev(`
            (function(){
                var card = [...document.querySelectorAll('.card')].find(x => /状态/.test(x.querySelector('h2').textContent));
                return [...card.querySelectorAll('button')].filter(b => /添加状态/.test(b.textContent)).length;
            })()
        `));

        await ev(`
            (function(){
                var card = [...document.querySelectorAll('.card')].find(x => /状态/.test(x.querySelector('h2').textContent));
                var rows = [...card.querySelectorAll('.field')];
                var w = rows[rows.length - 1].querySelector('input[type=number]');
                w.value = 25;
                w.dispatchEvent(new Event('input'));
            })()
        `);
        console.log('改权重后:', await weights());
        console.log('YAML 里 states 片段:', await ev("document.getElementById('yaml').textContent.match(/state1:[\\s\\S]{0,90}/)[0]"));

        await ev(`
            (function(){
                var card = [...document.querySelectorAll('.card')].find(x => /状态/.test(x.querySelector('h2').textContent));
                var rows = [...card.querySelectorAll('.field')];
                [...rows[rows.length - 1].querySelectorAll('button')].find(b => /删除状态/.test(b.textContent)).click();
            })()
        `);
        await sleep(300);
        console.log('删除后:', await ev("Object.keys(cfg.states).join(',')"));

        await ev(`
            (function(){
                var card = [...document.querySelectorAll('.card')].find(x => /状态/.test(x.querySelector('h2').textContent));
                card.scrollIntoView({ block: 'start' });
            })()
        `);
        await sleep(300);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/config-states.png', Buffer.from(shot.result.data, 'base64'));
    } finally {
        chrome.kill();
    }
})();
