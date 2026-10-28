const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9681);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8431);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-panel2',
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

        console.log('内核方法:', await ev("Object.keys(PetDebug['deepseek-pet'].kernel||{}).join(',')"));
        console.log('模块:', await ev("(PetDebug['deepseek-pet'].kernel.modules&&PetDebug['deepseek-pet'].kernel.modules()||[]).map(m=>m.id||m).join(',')"));
        console.log('--- 直接 cue ---');
        console.log('cue spin:', await ev("(function(){var d=PetDebug['deepseek-pet'];try{d.director.cue('spin');return 'ok'}catch(e){return 'ERR '+e.message}})()"));
        await sleep(400);
        console.log('player.name:', await ev("PetDebug['deepseek-pet'].player.name()"));
        console.log('--- intent.action ---');
        console.log('emit:', await ev("(function(){try{PetKernel.emit('intent.action',{act:'tail',level:'direct',duration:2000});return 'ok'}catch(e){return 'ERR '+e.message}})()"));
        await sleep(500);
        console.log('player.name:', await ev("PetDebug['deepseek-pet'].player.name()"));
        console.log('--- 内核拒绝? ---');
        console.log('log 尾部:', await ev("JSON.stringify((PetDebug['deepseek-pet'].kernel.log()||[]).slice(-6))"));
        console.log('--- 气泡节点 ---');
        console.log('bubble class:', await ev("(document.querySelector('.dp-bubble')||{}).className"));
        console.log('bubble 文本:', await ev("(document.querySelector('.dp-bubble')||{}).textContent"));
        console.log('--- 手动说一句 ---');
        await ev("PetKernel.emit('speech.act',{text:'面板自检一句话',channel:'auto',priority:'reply',ttl:3000})");
        await sleep(300);
        console.log('bubble class:', await ev("(document.querySelector('.dp-bubble')||{}).className"));
        console.log('bubble 文本:', await ev("(document.querySelector('.dp-bubble')||{}).textContent"));
    } finally {
        chrome.kill();
    }
})();
