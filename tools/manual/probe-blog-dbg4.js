const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9502);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8261);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    // 先自己确认服务器活着
    try {
        const r = await fetch(BASE + '/');
        const html = await r.text();
        console.log('服务器:', r.status, '| 长度:', html.length, '| 含 custom-global:', /custom-global/.test(html));
    } catch (e) {
        console.log('服务器不可达:', e.message);
        return;
    }

    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,860',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-dbg4',
        BASE + '/'], { stdio: 'ignore' });

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
        await sleep(7000);

        console.log('location:', await ev('location.href'));
        console.log('title:', await ev('document.title'));
        console.log('scripts:', await ev("[...document.scripts].map(s=>s.src||'(inline)').filter(s=>/custom-global|pet/.test(s)).join(' | ') || '无'"));
        console.log('dp-root:', await ev("!!document.querySelector('.dp-root')"));
        console.log('PetKernel:', await ev("typeof window.PetKernel"));
    } catch (e) {
        console.log('probe 出错:', e.message);
    } finally {
        chrome.kill();
    }
})();
