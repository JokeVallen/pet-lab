const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9591);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8341);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-content',
        BASE + '/index.html'], { stdio: 'ignore' });

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

    const say = async (text) => {
        await ev(`
            (function(){
                var chat = document.querySelector('.dp-chat');
                if (!chat.classList.contains('is-open')) document.querySelector('[data-dp-action="chat"]').click();
                var input = document.querySelector('.dp-chat-input');
                input.value = ${JSON.stringify(text)};
                input.dispatchEvent(new Event('input', {bubbles:true}));
                document.querySelector('.dp-chat-form').dispatchEvent(new Event('submit', {bubbles:true, cancelable:true}));
                return 1;
            })()
        `);
        await sleep(500);
        return ev(`(function(){
            var all = [...document.querySelectorAll('.dp-msg.is-pet')];
            return all.length ? all[all.length - 1].textContent : '(没有回复)';
        })()`);
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

        console.log('0) 挂载 UI 文案:', await ev(`JSON.stringify({
            标题: document.querySelector('.dp-chat-head span').textContent,
            占位符: document.querySelector('.dp-chat-input').placeholder,
            发送: document.querySelector('.dp-chat-send').textContent,
            投喂: document.querySelector('[data-dp-action=feed]').title,
            状态: document.querySelector('.dp-status').textContent
        })`));

        console.log('1) 中文「你好」:', await say('你好'));
        console.log('2) 中文「有没有讲算法的」:', await say('有没有讲算法的'));

        console.log('3) 切到英文:', await ev("(function(){ var P = window.PetDebug['deepseek-pet']; return String(P.content.setLang('en')); })()"));
        console.log('4) 英文「hello」:', await say('hello'));
        console.log('5) 英文「what can you do」:', await say('what can you do'));

        console.log('6) 气泡（点一下角色）:', await ev(`
            (function(){
                document.querySelector('.dp-chat-close').click();
                return 1;
            })()
        `) && await (async () => {
            const geo = JSON.parse(await ev(`
                (function(){ var r = document.querySelector('.dp-character').getBoundingClientRect();
                  return JSON.stringify({ cx: Math.round(r.left + r.width/2), cy: Math.round(r.top + r.height*0.4) }); })()
            `));
            await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: geo.cx, y: geo.cy, button: 'left', clickCount: 1, buttons: 1 });
            await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: geo.cx, y: geo.cy, button: 'left', clickCount: 1, buttons: 0 });
            await sleep(800);
            return ev("document.querySelector('.dp-bubble').textContent");
        })());

        console.log('7) 切回中文:', await ev("(function(){ var P = window.PetDebug['deepseek-pet']; return String(P.content.setLang('zh')); })()"));
        console.log('8) 中文气泡:', await (async () => {
            const geo = JSON.parse(await ev(`
                (function(){ var r = document.querySelector('.dp-character').getBoundingClientRect();
                  return JSON.stringify({ cx: Math.round(r.left + r.width/2), cy: Math.round(r.top + r.height*0.4) }); })()
            `));
            await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: geo.cx, y: geo.cy, button: 'left', clickCount: 1, buttons: 1 });
            await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: geo.cx, y: geo.cy, button: 'left', clickCount: 1, buttons: 0 });
            await sleep(800);
            return ev("document.querySelector('.dp-bubble').textContent");
        })());
    } finally {
        chrome.kill();
    }
})();
