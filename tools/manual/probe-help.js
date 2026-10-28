const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9595);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8345);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,980',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-help',
        BASE + '/config-editor.html'], { stdio: 'ignore' });

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
    const nav = async (page) => { await send('Page.navigate', { url: BASE + '/' + page }); await sleep(3500); };

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

        for (const page of ['config-editor.html', 'zone-editor.html', 'rules-editor.html']) {
            await nav(page);
            const zh = await ev("(function(){var d=document.querySelector('.help-panel');return d? d.textContent.length : 0})()");
            const btn = await ev("document.querySelectorAll('header button').length");
            const hasFactory = await ev("[...document.querySelectorAll('header button')].some(b => /恢复出厂|factory/i.test(b.textContent))");
            console.log(page, '| 说明长度', zh, '| 头部按钮', btn, '| 有恢复出厂', hasFactory);

            // 切英文看说明
            await ev("PetI18n.setLang('en')");
            await sleep(500);
            const en = await ev("(function(){var d=document.querySelector('.help-panel');return d? d.textContent.slice(0,110) : '(无)'})()");
            console.log('   en:', String(en).replace(/\s+/g, ' '));
            await ev("PetI18n.setLang('zh')");
            await sleep(300);
        }
    } finally {
        chrome.kill();
    }
})();
