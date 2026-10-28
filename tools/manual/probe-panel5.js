const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9684);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8434);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-panel5',
        BASE + '/?mock=1'], { stdio: 'ignore' });

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
        ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
        await send('Runtime.enable');
        await sleep(8000);

        console.log('打开对话框:', await ev("PetDebug['deepseek-pet'].chat(true); 'ok'"));
        await sleep(300);
        console.log('发 dialog 句:', await ev("PetKernel.emit('speech.act',{text:'对话通道自检',channel:'dialog',priority:'reply'}); 'sent'"));
        await sleep(500);
        console.log('chat-log:', await ev("(document.querySelector('.dp-chat-log')||{}).textContent"));
        console.log('关闭对话框:', await ev("PetDebug['deepseek-pet'].chat(false); 'ok'"));
        await sleep(200);
        console.log('发 bubble 句:', await ev("PetKernel.emit('speech.act',{text:'气泡通道自检',channel:'bubble',priority:'reply',ttl:3000}); 'sent'"));
        await sleep(500);
        console.log('bubble 文本:', await ev("(document.querySelector('.dp-bubble')||{}).textContent"));
        console.log('bubble class:', await ev("(document.querySelector('.dp-bubble')||{}).className"));
        console.log('再发一次同句:', await ev("PetKernel.emit('speech.act',{text:'气泡通道自检',channel:'bubble',priority:'reply',ttl:3000}); 'sent'"));
        await sleep(300);
        console.log('bubble 文本:', await ev("(document.querySelector('.dp-bubble')||{}).textContent"));
    } finally {
        chrome.kill();
    }
})();
