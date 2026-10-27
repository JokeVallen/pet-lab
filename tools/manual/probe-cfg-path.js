const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9469);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8212);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1200',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-cz',
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
        await sleep(3000);

        // 空值时：应出现不可选占位
        console.log('空值下拉:', await ev(`
            (function(){
                cfg.image = '';
                render();
                var f = [...document.querySelectorAll('.field')].find(x => /占位图/.test(x.textContent));
                var s = f.querySelector('select');
                return [...s.options].map(o => '[' + o.value + '|' + o.textContent + (o.disabled ? '|disabled' : '') + (o.selected ? '|sel' : '') + ']').join(' ');
            })()
        `));

        // 选一个真实值 → 应写入配置
        console.log('选值后:', await ev(`
            (function(){
                var f = [...document.querySelectorAll('.field')].find(x => /占位图/.test(x.textContent));
                var s = f.querySelector('select');
                s.value = '/images/pet/anim/poster.webp';
                s.dispatchEvent(new Event('change'));
                return cfg.image;
            })()
        `));

        // 手动输入
        console.log('手动输入:', await ev(`
            (function(){
                var f = [...document.querySelectorAll('.field')].find(x => /占位图/.test(x.textContent));
                var s = f.querySelector('select');
                s.value = '__custom';
                s.dispatchEvent(new Event('change'));
                var t = f.querySelector('input[type=text]');
                var shown = t.style.display !== 'none';
                t.value = 'images/custom.png';
                t.dispatchEvent(new Event('input'));
                return JSON.stringify({ 显示文本框: shown, 值: cfg.image });
            })()
        `));
    } finally {
        chrome.kill();
    }
})();
