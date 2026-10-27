const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9423);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8170);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,1000',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-sv',
        `${BASE}/config-editor.html`], { stdio: 'ignore' });

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
        await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', res); });
        ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
        await send('Runtime.enable');
        await send('Page.enable');
        await sleep(2600);

        console.log('加载后 YAML 首行:', await ev("document.getElementById('yaml').textContent.split('\\n')[0]"));
        console.log('乱码:', await ev("(document.getElementById('yaml').textContent.match(/\\ufffd/g)||[]).length"));

        // 改一个数值，走保存流程
        await ev(`(function(){
            var f = document.querySelector('input[data-path="shadow.offsetY"], #shadowOffsetY, input[name="shadow.offsetY"]');
            window.__f = f;
            return !!f;
        })()`);
        console.log('阴影输入框:', await ev("!!window.__f"));

        // 直接调用保存函数（与点按钮等价）
        await ev("saveAndBuild ? saveAndBuild() : null");
        await sleep(2500);
        console.log('保存状态:', await ev("document.getElementById('status').textContent"));

        // 重新加载页面，确认中文仍在
        await send('Page.reload', { ignoreCache: true });
        await sleep(3000);
        console.log('重载后首行:', await ev("document.getElementById('yaml').textContent.split('\\n')[0]"));
        console.log('重载后乱码:', await ev("(document.getElementById('yaml').textContent.match(/\\ufffd/g)||[]).length"));
        console.log('重载后含中文规则:', await ev("/别戳脑袋/.test(document.getElementById('yaml').textContent)"));
    } finally {
        chrome.kill();
    }
})();
