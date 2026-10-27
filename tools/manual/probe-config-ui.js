const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9445);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8190);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1400',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-c1',
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
        await sleep(3000);

        console.log('素材:', await ev("JSON.stringify({clips: ASSETS.clips.length, images: ASSETS.images.length, json: ASSETS.json.length, dirs: ASSETS.dirs})"));
        console.log('动画目录下拉:', await ev("(function(){var s=[...document.querySelectorAll('select')].find(x=>/images/.test(x.textContent)); return s? s.options.length + ' 项, 当前 ' + s.value : '无';})()"));
        console.log('占位图下拉项:', await ev("(function(){var s=[...document.querySelectorAll('.field')].find(f=>/占位图/.test(f.textContent)); var sel=f=>f.querySelector('select'); return s&&sel(s)? [...sel(s).options].map(o=>o.value).join(' | ') : '无';})()"));
        console.log('颜色控件有文本框:', await ev("(function(){var f=[...document.querySelectorAll('.field')].find(x=>/颜色/.test(x.textContent)); return !!(f && f.querySelector('input[type=text]'));})()"));
        console.log('颜色控件有滑块:', await ev("(function(){var f=[...document.querySelectorAll('.field')].find(x=>/颜色/.test(x.textContent)); return !!(f && f.querySelector('input[type=range]'));})()"));
        console.log('拖拽动画是下拉:', await ev("(function(){var f=[...document.querySelectorAll('.field')].find(x=>/拖拽动画/.test(x.textContent)); return !!(f && f.querySelector('select'));})()"));
        console.log('待机候选是点选:', await ev("(function(){var f=[...document.querySelectorAll('.field')].find(x=>/常驻待机/.test(x.textContent)); var c=f&&f.querySelector('.chips.pick'); return c? c.children.length + ' 个可点' : '无';})()"));
        console.log('状态卡片:', await ev("(function(){var c=[...document.querySelectorAll('.card')].find(x=>/状态/.test(x.querySelector('h2').textContent)); return c? [...c.querySelectorAll('.name')].length + ' 个状态' : '无';})()"));
        console.log('旧分类卡片:', await ev("!!([...document.querySelectorAll('.card h2')].find(x=>/分类/.test(x.textContent)))"));

        // 重复按钮检查：连点两次「添加状态」
        const before = await ev("document.querySelectorAll('.card button').length");
        await ev("(function(){var c=[...document.querySelectorAll('.card')].find(x=>/状态/.test(x.querySelector('h2').textContent)); c.querySelector('button:last-of-type').click(); c.querySelector('button:last-of-type').click();})()");
        await sleep(300);
        console.log('添加状态按钮数:', await ev("(function(){var c=[...document.querySelectorAll('.card')].find(x=>/状态/.test(x.querySelector('h2').textContent)); return [...c.querySelectorAll('button')].filter(b=>/添加状态/.test(b.textContent)).length;})()"));
    } finally {
        chrome.kill();
    }
})();
