const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9683);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8433);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-panel4',
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

        console.log('模块详情:', await ev("JSON.stringify((PetKernel.modules()||[]).map(m=>typeof m==='string'?m:Object.keys(m)))"));
        console.log('bubble 数量:', await ev("document.querySelectorAll('.dp-bubble').length"));
        console.log('root 骨架:', await ev("(function(){var r=document.querySelector('.dp-root');return r?Array.prototype.map.call(r.querySelectorAll('*'),e=>e.className&&String(e.className).trim()).filter(Boolean).join(' | '):'no root'})()"));
        console.log('发一句:', await ev("PetKernel.emit('speech.act',{text:'自检句子B',channel:'auto',priority:'reply',ttl:3000});'sent'"));
        await sleep(600);
        console.log('kernel log 尾:', await ev("JSON.stringify((PetDebug['deepseek-pet'].kernel.log()||[]).slice(-5))"));
        console.log('bubble 文本:', await ev("(document.querySelector('.dp-bubble')||{}).textContent"));
        console.log('PetRenderers:', await ev("typeof window.PetRenderers"));
        console.log('showBubble 可写? is-show 类:', await ev("Array.prototype.map.call(document.querySelectorAll('.dp-bubble'),e=>e.className).join(' / ')"));
    } finally {
        chrome.kill();
    }
})();
