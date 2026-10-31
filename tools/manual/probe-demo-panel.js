const { spawn } = require('child_process');
const fs = require('fs');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9594);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8344);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,980',
        '--force-device-scale-factor=1.5',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-demo',
        BASE + '/demo.html'], { stdio: 'ignore' });

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
        await sleep(6000);

        console.log('1) 面板分组:', await ev("[...document.querySelectorAll('.lab summary')].map(x => x.textContent).join(' / ')"));
        console.log('2) 动作按钮数:', await ev("document.querySelectorAll('#labActs button').length"));
        console.log('3) 读数:', await ev("document.getElementById('labRead').textContent"));

        console.log('4) 点「强制入睡」:', await ev("(function(){ labSleep(); return 1; })()"));
        await sleep(1200);
        console.log('   读数:', await ev("document.getElementById('labRead').textContent"));
        console.log('5) 点「叫醒」:', await ev("(function(){ labWake(); return 1; })()"));
        await sleep(900);
        console.log('   读数:', await ev("document.getElementById('labRead').textContent"));

        console.log('6) 提问:', await ev("(function(){ document.getElementById('labQ').value = '有没有讲算法的'; labAsk(); return 1; })()"));
        await sleep(600);
        console.log('   回答:', (await ev("document.getElementById('labAns').textContent") || '').slice(0, 80));

        console.log('7) 切英文 + 看配置:', await ev("(function(){ labLang('en'); labShowConfig(); return 1; })()"));
        await sleep(400);
        console.log('   面板标题:', await ev("document.querySelector('.lab summary').textContent"));
        console.log('   配置:', (await ev("document.getElementById('labCfg').textContent") || '').replace(/\s+/g, ' ').slice(0, 140));

        await ev("labLang('zh')");
        await sleep(300);

        const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1280, height: 980, scale: 1 } });
        fs.writeFileSync('docs/screenshots/demo-panel.png', Buffer.from(r.result.data, 'base64'));
        console.log('8) 截图已存 docs/screenshots/demo-panel.png');
    } finally {
        chrome.kill();
    }
})();
