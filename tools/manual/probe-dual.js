const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9506);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8265);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-dual',
        BASE + '/pets.html'], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const errs = [];
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
            if (m.method === 'Runtime.exceptionThrown') {
                const d = m.params.exceptionDetails;
                errs.push(d.exception && d.exception.description ? d.exception.description.split('\n')[0] : d.text);
            }
        });
        await send('Runtime.enable');
        await send('Page.enable');
        await sleep(7000);

        console.log('实例数:', await ev("document.querySelectorAll('.dp-root').length"));
        console.log('实例详情:', await ev(`
            (function(){
                return [...document.querySelectorAll('.dp-root')].map(function (r) {
                    var s = getComputedStyle(r);
                    var box = r.querySelector('.dp-character');
                    return {
                        id: r.id,
                        标题: (r.querySelector('.dp-chat-head span') || {}).textContent,
                        主色: s.getPropertyValue('--dp-primary').trim(),
                        右边距: s.right,
                        宽高: s.getPropertyValue('--dp-w').trim() + '×' + s.getPropertyValue('--dp-h').trim(),
                        位置: box ? Math.round(box.getBoundingClientRect().left) + ',' + Math.round(box.getBoundingClientRect().top) : '?'
                    };
                });
            })()
        `));
        console.log('存储键:', await ev("Object.keys(localStorage).filter(k => /pet/.test(k)).join(', ')"));
        console.log('视频在播:', await ev(`
            [...document.querySelectorAll('.dp-root video')].map(v => v.readyState + '/' + (v.paused ? '暂停' : '播放')).join(' | ')
        `));
        console.log('页面异常:', errs.length ? errs.join(' / ') : '无');

        // 两只各自喂食，看互不影响
        await ev("document.querySelector('#pet-cat [data-dp-action=feed]').click()");
        await sleep(1200);
        console.log('小橘气泡:', await ev("(document.querySelector('#pet-cat .dp-bubble')||{}).textContent"));
        console.log('大肥鱼气泡:', await ev("(document.querySelector('#deepseek-pet .dp-bubble')||{}).textContent || '（空）'"));

        await ev("document.querySelector('#deepseek-pet [data-dp-action=chat]').click()");
        await sleep(500);
        await ev("document.querySelector('#pet-cat [data-dp-action=chat]').click()");
        await sleep(600);

        const s = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/dual-pets.png', Buffer.from(s.result.data, 'base64'));
        console.log('截图: dual-pets.png');
    } finally {
        chrome.kill();
    }
})();
