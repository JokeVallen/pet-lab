const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9603);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8353);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-console',
        BASE + '/'], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const errors = [];
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
        ws.addEventListener('message', (e) => {
            const m = JSON.parse(e.data);
            if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
            if (m.method === 'Runtime.exceptionThrown') {
                const d = m.params.exceptionDetails;
                errors.push('exception  ' + (d.url || '?') + ':' + d.lineNumber + '  ' + (d.exception && d.exception.description || '').split('\n')[0]);
            }
            if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
                errors.push('log        ' + (m.params.entry.url || '?') + '  ' + m.params.entry.text.slice(0, 120));
            }
        });
        await send('Runtime.enable');
        await send('Log.enable');
        await sleep(5000);

        // 触发几类交互：开聊天、发一句、拖一下、点一下、切换隐藏/召回
        await ev("document.querySelector('[data-dp-action=\"chat\"]').click()");
        await sleep(600);
        await ev(`
            (function(){
                var i = document.querySelector('.dp-chat-input');
                i.value = '你好'; i.dispatchEvent(new Event('input', {bubbles:true}));
                document.querySelector('.dp-chat-form').dispatchEvent(new Event('submit', {bubbles:true, cancelable:true}));
            })()
        `);
        await sleep(700);
        await ev("document.querySelector('.dp-chat-close').click()");

        const geo = JSON.parse(await ev(`
            (function(){ var r = document.querySelector('.dp-character').getBoundingClientRect();
              return JSON.stringify({ cx: Math.round(r.left + r.width/2), cy: Math.round(r.top + r.height*0.4) }); })()
        `));
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: geo.cx, y: geo.cy, button: 'left', clickCount: 1, buttons: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: geo.cx + 40, y: geo.cy + 20, button: 'left', buttons: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: geo.cx + 40, y: geo.cy + 20, button: 'left', clickCount: 1, buttons: 0 });
        await sleep(600);
        await ev("document.querySelector('[data-dp-action=\"hide\"]').click()");
        await sleep(400);
        await ev("document.querySelector('[data-dp-action=\"restore\"]').click()");
        await sleep(800);

        console.log('页面:', await ev('location.href'));
        console.log('宠物挂载:', await ev("!!document.querySelector('.dp-root')"));
        console.log('捕获到的异常/错误条数:', errors.length);
        errors.forEach((e) => console.log('  ' + e));
        console.log('是否出现 content_main.js:', errors.some((e) => e.indexOf('content_main') >= 0) ? '是' : '否');
    } finally {
        chrome.kill();
    }
})();
