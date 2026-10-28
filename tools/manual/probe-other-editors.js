const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9581);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8331);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-guard2',
        'about:blank'], { stdio: 'ignore' });

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
    const goto = async (u) => { await send('Page.navigate', { url: u }); await sleep(2500); };

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
        });
        await send('Runtime.enable');
        await send('Page.enable');

        // ---------- zone-editor ----------
        await goto(BASE + '/zone-editor.html');
        await sleep(1500);
        console.log('zone 状态:', await ev("document.getElementById('status').textContent"));
        console.log('zone 分区:', await ev("JSON.stringify(zones.map(z => z.id + ' ' + z.yMin + '-' + z.yMax))"));
        console.log('zone 反应条数:', await ev("Object.keys(reactions).length"));

        // 存一次，确认只动 zones/zoneReactions，别的配置不受影响
        const before = JSON.parse(await ev(`
            fetch('config/pet.yaml?ts=' + Date.now(), {cache:'no-store'}).then(r => r.text()).then(t => {
                const m = t.match(/idleSleepMs: (\\d+)/);
                return JSON.stringify({ idle: m && m[1], hash: t.length });
            })
        `));
        await ev("saveZones()");
        await sleep(2500);
        console.log('zone 保存:', await ev("document.getElementById('status').textContent"));
        const after = JSON.parse(await ev(`
            fetch('config/pet.yaml?ts=' + Date.now(), {cache:'no-store'}).then(r => r.text()).then(t => {
                const m = t.match(/idleSleepMs: (\\d+)/);
                return JSON.stringify({ idle: m && m[1], zones: (t.match(/- id: /g) || []).length });
            })
        `));
        console.log('别的配置没被动:', before.idle === after.idle, '| 分区数:', after.zones);

        // ---------- rules-editor ----------
        await goto(BASE + '/rules-editor.html');
        await sleep(1500);
        console.log('rules 状态:', await ev("document.getElementById('status').textContent"));
        console.log('rules 条数:', await ev("typeof rules !== 'undefined' ? rules.length : '?'"),
            '| stateRules:', await ev("typeof stateRules !== 'undefined' ? stateRules.length : '?'"),
            '| 已载入:', await ev("String(!!window.__lastLoaded)"));

        // 断网模拟"读不到配置"：保存必须被拦住
        await send('Network.enable');
        await send('Network.setBlockedURLs', { urls: ['*config/pet.yaml*'] });
        await send('Page.reload');
        await sleep(3000);
        console.log('rules 断网后状态:', await ev("document.getElementById('status').textContent"));
        console.log('rules 弹窗测试:', await ev("(function(){ var r = rules.length; document.querySelector('button.primary').click(); return document.getElementById('status').textContent; })()"));
        await sleep(500);
        console.log('断网保存后:', await ev("document.getElementById('status').textContent"));
        await send('Network.setBlockedURLs', { urls: [] });
    } finally {
        chrome.kill();
    }
})();
