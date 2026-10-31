const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9592);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8342);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-content2',
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
        await sleep(6000);

        console.log('A) DOM 文案:', await ev(`JSON.stringify({
            chatHead: (document.querySelector('.dp-chat-head') || {}).textContent,
            placeholder: (document.querySelector('.dp-chat-input') || {}).placeholder,
            send: (document.querySelector('.dp-chat-send') || {}).textContent,
            feedTitle: (document.querySelector('[data-dp-action="feed"]') || {}).title,
            status: (document.querySelector('.dp-status') || {}).textContent
        })`));

        console.log('B) 语言:', await ev("window.PetDebug['deepseek-pet'].content.lang"));

        console.log('C) 中文回复:', await ev("JSON.stringify(['你好','你是谁','累死了','你有没有讲算法的'].map(function(q){ return q + ' → ' + window.PetDebug['deepseek-pet'].reply(q); }))"));

        console.log('D) 切英文:', await ev("String(window.PetContent.setLang('en'))"));
        console.log('E) 英文回复:', await ev("JSON.stringify(['hello','who are you','I am tired','what can you do'].map(function(q){ return q + ' → ' + window.PetDebug['deepseek-pet'].reply(q); }))"));
        console.log('F) 英文状态词:', await ev("document.querySelector('.dp-status').textContent"));
        console.log('G) 英文 zone 台词:', await ev("JSON.stringify(window.PetDebug['deepseek-pet'].config.zoneReactions ? Object.keys(window.PetDebug['deepseek-pet'].config.zoneReactions) : 'none')"));

        console.log('H) 切回中文:', await ev("String(window.PetContent.setLang('zh'))"));
        console.log('I) 中文状态词:', await ev("document.querySelector('.dp-status').textContent"));
    } finally {
        chrome.kill();
    }
})();
