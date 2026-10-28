const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9694);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8444);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1000',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-nomock',
        BASE + '/'], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const errors = [];
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
        for (let i = 0; i < 80 && !url; i++) {
            try {
                const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
                const p = list.find((t) => t.type === 'page' && t.url.indexOf('http') === 0);
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
                errors.push(((d.exception && d.exception.description) || '').split('\n')[0]);
            }
        });
        await send('Runtime.enable');
        await sleep(9000);

        console.log('无站点（无 SiteAPI）:', await ev("typeof SiteAPI"));
        console.log('站点面板提示:', await ev("document.getElementById('labSite').textContent"));
        console.log('点一个 mock 按钮（应只提示，不报错）:');
        console.log(' →', await ev("mockCtx('tag'); 'clicked'"));
        await sleep(300);
        console.log(' → 面板:', await ev("document.getElementById('labSite').textContent"));
        console.log('动作按钮仍可用:', await ev("document.querySelectorAll('#labActs button')[7].click(); 'clicked'"));
        await sleep(400);
        console.log(' → act:', await ev("PetDebug['deepseek-pet'].player.name()"));
        console.log('状态读数:', await ev("document.getElementById('labState').textContent"));
        console.log('问一句（本地句库）:');
        await ev("document.getElementById('labQ').value='你是谁'");
        await ev('labAsk()');
        await sleep(600);
        console.log(' → ', await ev("document.getElementById('labAns').textContent"));
        console.log('异常:', errors.length ? errors.slice(0, 4).join('\n') : '无');
    } finally {
        chrome.kill();
    }
})();
