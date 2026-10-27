const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9426);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || '8123');

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-uk',
        `${BASE}/home.html`], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const send = (method, params) => new Promise((resolve) => {
        const myId = ++id;
        pending.set(myId, resolve);
        ws.send(JSON.stringify({ id: myId, method, params: params || {} }));
    });
    const ev = async (expression) => {
        const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) return 'EXC';
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
        await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
        ws.addEventListener('message', (e) => {
            const m = JSON.parse(e.data);
            if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
        });
        await send('Runtime.enable');
        await send('Page.enable');

        for (const [page, mutate, check] of [
            ['zone-editor.html', "addZone()", "zones.length"],
            ['rules-editor.html', "addRule()", "rules.length"],
            ['config-editor.html', "cfg.shadow.offsetX = 9; render(); schedulePush();", "cfg.shadow.offsetX"]
        ]) {
            await send('Page.navigate', { url: BASE + '/' + page });
            await sleep(2500);
            await ev(mutate);
            await sleep(700);
            const afterMutate = await ev(check);
            // 焦点在 body 上按 Ctrl+Z
            await ev("document.body.focus(); document.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true}))");
            await sleep(400);
            const afterUndo = await ev(check);
            await ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'y',ctrlKey:true,bubbles:true}))");
            await sleep(400);
            const afterRedo = await ev(check);
            console.log(`${page}: ${afterMutate} → undo ${afterUndo} → redo ${afterRedo}`);
        }
    } finally {
        chrome.kill();
    }
})();
