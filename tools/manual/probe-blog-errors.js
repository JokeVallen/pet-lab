const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9406);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8124);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-blog2',
        `${BASE}/`], { stdio: 'ignore' });

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

    const errors = [];
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
        await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
        ws.addEventListener('message', (e) => {
            const m = JSON.parse(e.data);
            if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
            if (m.method === 'Runtime.exceptionThrown') {
                const d = m.params.exceptionDetails;
                errors.push('EXCEPTION ' + (d.exception && d.exception.description ? d.exception.description.split('\n')[0] : d.text));
            }
            if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
                errors.push('LOG ' + m.params.entry.text.slice(0, 160));
            }
        });
        await send('Runtime.enable');
        await send('Log.enable');
        await send('Page.enable');
        await sleep(6000);

        console.log('kernel:', await ev("typeof window.PetKernel"));
        console.log('root:', await ev("!!document.getElementById('deepseek-pet')"));
        console.log('script tag:', await ev("!!document.querySelector('script[data-pet-module]')"));
        console.log('modules:', await ev("window.PetKernel ? JSON.stringify(PetKernel.modules()) : '-'"));
        console.log('errors:');
        errors.slice(0, 8).forEach((e) => console.log('   ', e));
    } finally {
        chrome.kill();
    }
})();
