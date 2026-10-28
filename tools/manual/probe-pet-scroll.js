const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9625);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8375);
const PAGE = process.argv[4] || '/posts/2026/01/01/7bac37c2e8d2/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-petscroll',
        BASE + PAGE], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const send = (m, p) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) {
            const d = r.result.exceptionDetails.exception;
            return 'EXC ' + (d && d.description ? d.description.split('\n').slice(0, 2).join(' | ') : '');
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
        await sleep(9000);

        console.log('起始 ratio:', await ev("PetDebug['deepseek-pet'].adapter.scrollRatio()"));
        await ev('window.scrollTo(0, Math.round(document.documentElement.scrollHeight * 0.95))');
        await sleep(3500);
        console.log('滚到底后 ratio:', await ev("PetDebug['deepseek-pet'].adapter.scrollRatio()"));
        console.log('气泡文字:', await ev("(document.querySelector('.dp-bubble') || {}).textContent || '（无）'"));
        console.log('reading.get:', await ev('JSON.stringify(SiteAPI.reading().get())'));

        await ev('window.scrollTo(0, 0)');
        await sleep(3500);
        console.log('回顶部后 ratio:', await ev("PetDebug['deepseek-pet'].adapter.scrollRatio()"));
    } finally {
        chrome.kill();
    }
})();
