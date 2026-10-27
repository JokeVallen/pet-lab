const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9520);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8280);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,860',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-dist',
        BASE + '/'], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const bad = [];
    const errs = [];
    const ok = [];
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
        ws.addEventListener('message', (e) => {
            const m = JSON.parse(e.data);
            if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
            if (m.method === 'Network.responseReceived') {
                const r = m.params.response;
                if (/\/images\/pet\//.test(r.url)) {
                    if (r.status >= 400) bad.push(r.status + ' ' + r.url);
                    else ok.push(r.url);
                }
            }
            if (m.method === 'Runtime.exceptionThrown') {
                const d = m.params.exceptionDetails;
                errs.push(d.exception && d.exception.description ? d.exception.description.split('\n')[0] : d.text);
            }
        });
        await send('Runtime.enable');
        await send('Network.enable');
        await send('Page.enable');
        await sleep(7000);

        console.log('挂载:', await ev("!!document.querySelector('.dp-root')"));
        console.log('标题:', await ev("(document.querySelector('.dp-chat-head span')||{}).textContent"));
        console.log('立绘:', await ev("(document.querySelector('.dp-art')||{}).getAttribute('src')"));
        console.log('视频:', await ev("[...document.querySelectorAll('.dp-video')].map(v => v.readyState + (v.paused ? 'p' : '播放')).join(',')"));
        console.log('素材请求:', ok.length, '成功 /', bad.length, '失败', bad.slice(0, 3).join(' | '));
        console.log('异常:', errs.length ? errs.join(' | ') : '无');
        console.log('样式生效:', await ev("getComputedStyle(document.querySelector('.dp-root')).position"));
    } finally {
        chrome.kill();
    }
})();
