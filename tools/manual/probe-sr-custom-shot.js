const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9486);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8244);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1000',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-sr7',
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

        // 第 1 条：换成没注册的自定义键
        await ev(`
            (function(){
                var row = document.querySelector('.srrow .cond');
                var sel = row.querySelector('select');
                sel.value = '__custom';
                sel.dispatchEvent(new Event('change'));
                var inp = row.querySelector('.keyin');
                inp.value = 'hasQuote';
                inp.dispatchEvent(new Event('change'));
            })()
        `);
        await sleep(200);
        console.log('自定义行:', await ev(`
            (function(){
                var row = document.querySelector('.srrow .cond');
                return JSON.stringify({
                    when: stateRules[0].when,
                    键名框: row.querySelector('.keyin').value,
                    警告: row.querySelector('.condwarn').style.display !== 'none'
                });
            })()
        `));

        // 第 2 条：已注册的键不该有警告（这里对比第一条足够）
        await ev(`
            (function(){
                var card = document.querySelector('.srule-card');
                window.scrollTo(0, Math.max(0, window.scrollY + card.getBoundingClientRect().top - 90));
            })()
        `);
        await sleep(300);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/rules-staterules-custom.png', Buffer.from(shot.result.data, 'base64'));
        console.log('截图字节:', Buffer.from(shot.result.data, 'base64').length);
    } finally {
        chrome.kill();
    }
})();
