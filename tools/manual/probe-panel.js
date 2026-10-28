const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9691);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8441);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1100',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-panelx',
        BASE + '/?mock=1'], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const errors = [];
    const send = (m, p) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) {
            const d = r.result.exceptionDetails.exception;
            return 'EXC ' + (d && d.description ? d.description.split('\n')[0] : '');
        }
        return r.result && r.result.result ? r.result.result.value : undefined;
    };
    const bubble = async () => (await ev("(document.querySelector('.dp-bubble')||{}).textContent || '（空）'")) || '';
    const clip = () => ev("PetDebug['deepseek-pet'].player.name()");

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
        ws.addEventListener('message', (e) => {
            const m = JSON.parse(e.data);
            if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
            if (m.method === 'Runtime.exceptionThrown') {
                const d = m.params.exceptionDetails;
                errors.push(((d.exception && d.exception.description) || '').split('\n')[0]);
            }
        });
        await send('Runtime.enable');
        await sleep(9000);

        console.log('内核是活实例:', await ev("typeof PetKernel.emit==='function' && (PetKernel.modules? 'ok':'?')"));
        console.log('状态读数:', await ev("document.getElementById('labState').textContent"));

        console.log('\n--- 动作：逐个点三个，确认播放 ---');
        for (const idx of [7, 8, 13]) {           // spin / tail / eat
            const name = await ev(`document.querySelectorAll('#labActs button')[${idx}].textContent`);
            await ev(`document.querySelectorAll('#labActs button')[${idx}].click()`);
            await sleep(450);
            console.log('点', name, '→ act:', await clip());
            await sleep(300);
        }

        console.log('\n--- 喂食 / 戳 ---');
        await ev('labFeed()');
        await sleep(400);
        console.log('feed → act:', await clip(), '| 气泡:', await bubble());
        await ev("labPoke('head')");
        await sleep(400);
        console.log('head → act:', await clip(), '| 气泡:', await bubble());
        await ev("labPoke('tail')");
        await sleep(500);
        console.log('tail → act:', await clip(), '| 气泡:', await bubble());

        console.log('\n--- 说话 + 对话框开关 ---');
        await ev("labSpeech('ambient')");
        await sleep(400);
        console.log('闲话气泡:', await bubble());
        await ev("labSpeech('dialog')");
        await sleep(400);
        console.log('对话框打开:', await ev("!!document.querySelector('.dp-chat.is-open')"),
            '| 日志末行:', await ev("(document.querySelectorAll('.dp-msg.is-pet')||[]).length"));
        await ev('labChatClose()');
        await sleep(300);
        console.log('关闭后:', await ev("!!document.querySelector('.dp-chat.is-open')"));
        await ev("labSpeech('context')");
        await sleep(400);
        console.log('关窗后还能冒泡:', await bubble());

        console.log('\n--- 站点：主题 / 收藏（气泡模式下）---');
        await ev('mockTheme()');
        await sleep(700);
        console.log('切主题 → dark:', await ev("PetDebug['deepseek-pet'].adapter.isDark()"), '| 气泡:', await bubble());
        await ev('mockBookmark()');
        await sleep(700);
        console.log('收藏 → 气泡:', await bubble());

        console.log('\n--- 站点：上下文切换 ---');
        for (const kind of ['tag', 'home', '404', 'post']) {
            await ev(`mockCtx('${kind}')`);
            await sleep(350);
            const c = await ev("PetDebug['deepseek-pet'].context()");
            console.log(kind, '→', c && c.type, c && c.path);
        }

        console.log('\n--- 异常 ---');
        console.log(errors.length ? errors.slice(0, 5).join('\n') : '无');
    } finally {
        chrome.kill();
    }
})();
