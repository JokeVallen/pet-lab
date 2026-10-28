const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9622);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8372);
const PAGE = process.argv[4] || '/posts/2026/01/01/7bac37c2e8d2/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-petmeta',
        BASE + PAGE], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const send = (m, p) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) {
            const d = r.result.exceptionDetails.exception;
            return 'EXC ' + (d && d.description ? d.description.split('\n').slice(0, 3).join(' | ') : '');
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
        await sleep(8000);

        console.log('adapter.available:', await ev("PetDebug['deepseek-pet'].adapter.available()"));
        console.log('config.site:', await ev("JSON.stringify(PetDebug['deepseek-pet'].config.site)"));
        console.log('直接查内容库:', await ev(`
            PetDebug['deepseek-pet'].site.documentByPath('/posts/2026/01/01/7bac37c2e8d2/')
              .then(d => JSON.stringify(d && { tags: d.tags, words: d.word_count }))
        `));
        console.log('调用 loadMeta:', await ev(`
            PetDebug['deepseek-pet'].adapter.loadMeta()
              .then(d => JSON.stringify(d && { tags: d.tags, words: d.word_count }))
              .catch(e => 'ERR ' + e.message)
        `));
        await sleep(500);
        console.log('之后 context:', await ev("JSON.stringify(PetDebug['deepseek-pet'].context())"));
    } finally {
        chrome.kill();
    }
})();
