const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9489);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8247);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1100',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-yq',
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

        // 造一个空串文本条件和一个布尔条件，看导出
        await ev(`
            (function(){
                stateRules[0].when.emptyText = '';
                stateRules[0].when.dark = true;
                render();
            })()
        `);
        const yamlText = await ev("toYaml()");
        console.log('导出相关行:');
        String(yamlText).split('\n').slice(0, 6).forEach((l) => console.log('  ' + l));
        console.log('parse 回来看类型:', await ev(`
            (function(){
                var doc = jsyaml.load(toYaml());
                var when = doc.policy.stateRules[0].when;
                return JSON.stringify({ emptyText: when.emptyText, type: typeof when.emptyText, dark: when.dark, hourLt: when.hourLt });
            })()
        `));
    } finally {
        chrome.kill();
    }
})();
