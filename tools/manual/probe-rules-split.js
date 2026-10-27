const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9466);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8226);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1200',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-sp',
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

        console.log('状态栏:', await ev("document.getElementById('status').textContent"));
        console.log('权重卡片:', await ev("document.querySelector('.card.weights') ? '还在' : '已移除'"));
        console.log('规则数:', await ev("rules.length"));
        console.log('导出首行:', await ev("toYaml().split('\\n')[0] + ' / ' + toYaml().split('\\n')[1]"));
        console.log('导出含 states:', await ev("/^states:/m.test(toYaml()) ? '是（不该）' : '否'"));
        console.log('撤销快照:', await ev("JSON.parse(snapshot()).length !== undefined ? 'rules 数组' : '对象'"));
        console.log('动作折叠:', await ev("document.querySelectorAll('.acts').length + ' 展开 / 摘要 ' + document.querySelectorAll('.actprev').length"));
        console.log('条件下拉项:', await ev("document.querySelector('.cond select').options.length"));

        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/rules-editor.png', Buffer.from(shot.result.data, 'base64'));
    } finally {
        chrome.kill();
    }
})();
