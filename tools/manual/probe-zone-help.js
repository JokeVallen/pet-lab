const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9440);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8183);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1200',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-z8',
        `${BASE}/zone-editor.html`], { stdio: 'ignore' });

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
        await sleep(2500);

        // 1. 文件输入是否还在（之前被 i18n 掏空）
        console.log('bgFile 存在:', await ev("!!document.getElementById('bgFile')"));
        console.log('bgFile 在 label 内:', await ev("!!document.getElementById('bgFile').closest('label')"));
        console.log('label 文本:', await ev("document.querySelector('#bgFile').closest('label').textContent.trim()"));
        console.log('导入 input 存在:', await ev("!!document.getElementById('file')"));

        // 2. 帮助面板内容
        await ev("document.querySelector('.help-panel') && (document.querySelector('.help-panel').open = true)");
        await ev("document.querySelector('.help-panel summary').click()");
        await sleep(150);
        const help = await ev("document.querySelector('.help-panel').textContent");
        console.log('帮助含 N 快捷键:', /按 N|Press N/.test(help));
        console.log('帮助含 Del:', /Del/.test(help));
        console.log('帮助含 Shift:', /Shift/.test(help));
        console.log('帮助字数:', help.length);
        console.log('kbd 元素数:', await ev("document.querySelectorAll('.help-panel kbd').length"));
        console.log('底部提示已移除:', await ev("!document.querySelector('.stage + .hint')"));

        // 3. N 快捷键
        await ev("document.body.focus()");
        await ev("document.dispatchEvent(new KeyboardEvent('keydown', {key:'n', bubbles:true}))");
        await sleep(150);
        console.log('按 N 后进入框选:', await ev("document.getElementById('stage').classList.contains('draw-mode')"));
        await ev("document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}))");
        await sleep(150);
        console.log('Esc 退出框选:', await ev("!document.getElementById('stage').classList.contains('draw-mode')"));

        // 4. 两个重置按钮各在两个卡片里
        console.log('重置按钮位置:', await ev("JSON.stringify([...document.querySelectorAll('button')].filter(b=>/恢复默认/.test(b.textContent)).map(b=>b.closest('.card').querySelector('h2').textContent))"));

        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/zone-help.png', Buffer.from(shot.result.data, 'base64'));
    } finally {
        chrome.kill();
    }
})();
