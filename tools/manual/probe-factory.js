const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9597);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8347);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,980',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-factory',
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
    const nav = async (page) => { await send('Page.navigate', { url: BASE + '/' + page }); await sleep(3800); };

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
            if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
            if (m.method === 'Page.javascriptDialogOpening') {
                console.log('   弹窗:', m.params.message.replace(/\s+/g, ' ').slice(0, 70));
                send('Page.handleJavaScriptDialog', { accept: true });
            }
        });
        await send('Runtime.enable');
        await send('Page.enable');
        await sleep(4000);

        // ---- config-editor：改一个值，再恢复出厂 ----
        console.log('1) config-editor 改 idleSleepMs:', await ev(`
            (function(){
                var before = cfg.idleSleepMs;
                cfg.idleSleepMs = 12345; render();
                return before + ' → ' + cfg.idleSleepMs;
            })()
        `));
        await ev("resetFactory()");
        await sleep(1500);
        console.log('   恢复后:', await ev("String(cfg.idleSleepMs)"), '| 状态:', await ev("document.getElementById('status').textContent"));

        // ---- rules-editor：停用一条规则，再恢复出厂 ----
        await nav('rules-editor.html');
        console.log('2) rules 停用第 1 条:', await ev(`
            (function(){
                var b = document.querySelector('#list .rule:not(.srule-card) .en input');
                b.checked = false; b.dispatchEvent(new Event('change', {bubbles:true}));
                return JSON.stringify(rules[0].enabled);
            })()
        `));
        await ev("resetFactory()");
        await sleep(1500);
        console.log('   恢复后 enabled:', await ev("JSON.stringify(rules[0].enabled)"),
                    '| 勾选状态:', await ev("document.querySelector('#list .rule:not(.srule-card) .en input').checked"),
                    '| 状态:', await ev("document.getElementById('status').textContent"));

        // ---- zone-editor：删分区，再恢复出厂 ----
        await nav('zone-editor.html');
        console.log('3) zone 删除一个分区:', await ev(`
            (function(){
                var n = zones.length; zones.pop(); selected = 0; selectedSet = new Set([0]); draw();
                return n + ' → ' + zones.length;
            })()
        `));
        await ev("resetFactory()");
        await sleep(1500);
        console.log('   恢复后分区数:', await ev("zones.length"), '| 状态:', await ev("document.getElementById('status').textContent"));
    } finally {
        chrome.kill();
    }
})();
