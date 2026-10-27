const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9501);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8260);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,860',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-dbg3',
        'about:blank'], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const events = [];
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
                events.push('EXC ' + (d.exception && d.exception.description ? d.exception.description.split('\n').slice(0, 3).join(' ¦ ') : d.text));
            }
            if (m.method === 'Runtime.consoleAPICalled') {
                events.push('CONSOLE ' + m.params.type + ' ' + m.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 200));
            }
            if (m.method === 'Log.entryAdded') {
                const en = m.params.entry;
                events.push('LOG ' + en.level + ' [' + en.source + '] ' + en.text.slice(0, 200));
            }
            if (m.method === 'Network.loadingFailed') {
                events.push('NETFAIL ' + m.params.errorText);
            }
        });
        await send('Runtime.enable');
        await send('Log.enable');
        await send('Network.enable');
        await send('Page.enable');
        await send('Page.navigate', { url: BASE + '/' });
        await sleep(8000);

        console.log('挂载:', await ev("!!document.querySelector('.dp-root')"));
        console.log('事件:');
        events.slice(0, 14).forEach((x) => console.log('  ' + x));
        console.log('--- 直接 import 试试 ---');
        console.log(await ev(`
            (async function(){
                try {
                    var m = await import('/js/pet/index.js');
                    return 'import ok: ' + Object.keys(m).join(',');
                } catch (e) {
                    return 'import 失败: ' + (e && e.message ? e.message : e);
                }
            })()
        `));
    } finally {
        chrome.kill();
    }
})();
