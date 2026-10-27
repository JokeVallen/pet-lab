const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9476);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8219);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1200',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-r2',
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

        console.log('状态栏:', await ev("document.getElementById('status').textContent"));
        console.log('RUNTIME 可用:', await ev("!!(window.RUNTIME || (typeof RUNTIME !== 'undefined' && RUNTIME))"));
        console.log('条件键数:', await ev("KEYS.length"));
        console.log('内置键都认识:', await ev("KEYS.every(k => knowsKey(k))"));
        console.log('类型抽样:', await ev("JSON.stringify({dark: kindOf('dark'), tags: kindOf('tagsAny'), page: kindOf('page'), words: kindOf('wordsGt')})"));

        // 注册一个新条件，看编辑器是否自动跟上
        console.log('注册后键数:', await ev(`
            (function(){
                RUNTIME.registerWhen('hasQuote', { kind: 'bool', test: function(c){ return c.words > 100; } });
                KEYS = RUNTIME.getWhenKeys();
                return KEYS.length + ' / hasQuote=' + KEYS.indexOf('hasQuote');
            })()
        `));
        console.log('新键被认:', await ev("knowsKey('hasQuote') + ' kind=' + kindOf('hasQuote') + ' default=' + defaultValue('hasQuote')"));
        console.log('未注册键:', await ev("knowsKey('nope') + ' default=' + JSON.stringify(defaultValue('nope'))"));
        console.log('parseValue:', await ev("JSON.stringify([parseValue('dark','true'), parseValue('tagsAny','a, b'), parseValue('wordsGt','120'), parseValue('page','post')])"));
    } finally {
        chrome.kill();
    }
})();
