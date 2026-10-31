const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9387);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8126);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-rc',
        `${BASE}/demo.html`], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const send = (method, params) => new Promise((resolve) => {
        const myId = ++id;
        pending.set(myId, resolve);
        ws.send(JSON.stringify({ id: myId, method, params: params || {} }));
    });
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) return 'EXC';
        return r.result && r.result.result ? r.result.result.value : undefined;
    };
    const name = () => ev("import('/js/pet/config.js').then(m => m.default.name)");

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
        ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
        await send('Runtime.enable');
        await send('Page.enable');
        await sleep(2500);

        console.log('刷新前:', await name());

        // 走真实流程改配置：save + build
        const fs = require('fs');
        const yamlPath = 'D:\\Users\\User\\pet-lab\\config\\pet.yaml';
        const original = fs.readFileSync(yamlPath, 'utf8');
        const changed = original.replace(/^name: .*$/m, 'name: 缓存测试鱼');
        await fetch(BASE + '/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: 'config/pet.yaml', content: changed }) });
        const build = await (await fetch(BASE + '/api/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json();
        console.log('编译:', build.ok);

        // 普通刷新（相当于按 F5）
        await send('Page.reload', { ignoreCache: false });
        await sleep(2500);
        console.log('刷新后:', await name());

        // 强刷
        await send('Page.reload', { ignoreCache: true });
        await sleep(2500);
        console.log('强刷后:', await name());

        // 还原
        await fetch(BASE + '/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: 'config/pet.yaml', content: original }) });
        await fetch(BASE + '/api/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    } finally {
        chrome.kill();
    }
})();
