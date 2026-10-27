const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9499);
const BASE = process.argv[2] || 'http://127.0.0.1:8258';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,860',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-dbg',
        `${BASE}/`], { stdio: 'ignore' });

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
                events.push('EXC ' + (d.exception && d.exception.description ? d.exception.description.split('\n')[0] : d.text));
            }
            if (m.method === 'Runtime.consoleAPICalled') {
                events.push('CONSOLE ' + m.params.type + ' ' + m.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 160));
            }
            if (m.method === 'Log.entryAdded') {
                events.push('LOG ' + m.params.entry.level + ' ' + m.params.entry.text.slice(0, 160));
            }
            if (m.method === 'Network.loadingFailed') {
                events.push('NET-FAIL ' + (m.params.errorText || '') + ' ' + (m.params.requestId || ''));
            }
        });
        await send('Runtime.enable');
        await send('Log.enable');
        await send('Network.enable');
        await send('Page.enable');
        await sleep(7000);

        console.log('挂载:', await ev("!!document.querySelector('.dp-root')"));
        console.log('脚本标签:', await ev("[...document.querySelectorAll('script[data-pet-module]')].length"));
        console.log('事件:', events.slice(0, 8).join('\n         ') || '无');
    } finally {
        chrome.kill();
    }
})();
