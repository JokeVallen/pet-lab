const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9700);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8450);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1200',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-state',
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
    const mstate = () => ev("(PetDebug['deepseek-pet'].machine||{}).state && PetDebug['deepseek-pet'].machine.state()");
    const pool = () => ev("((PetDebug['deepseek-pet'].machine||{}).actions && PetDebug['deepseek-pet'].machine.actions()||[]).join(',')");

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

        console.log('状态机存在:', await ev("!!(PetDebug['deepseek-pet'].machine && PetDebug['deepseek-pet'].machine.set)"));
        console.log('初始 state:', await mstate(), '| pool:', await pool());
        console.log('面板读数:', await ev("document.getElementById('labState').textContent"));

        for (const s of ['busy', 'sleepy', 'idle']) {
            await ev(`labState('${s}')`);
            await sleep(350);
            console.log(`点「${s}」→ state:`, await mstate(), '| pool:', await pool());
        }
        console.log('面板读数:', await ev("document.getElementById('labState').textContent"));

        console.log('\n--- 手动指定是否被上下文刷新覆盖 ---');
        await ev("labState('busy')");
        await sleep(200);
        await ev("mockCtx('home')");     // 换页：应自动回到跟随
        await sleep(700);
        console.log('换页后 state:', await mstate(), '（home 无规则 → idle）');
        console.log('读数:', await ev("document.getElementById('labState').textContent"));

        console.log('\n--- 跟随上下文 ---');
        await ev("mockCtx('post')");
        await sleep(400);
        await ev('mockScroll(0.5)');     // 文章页 12%~92% → busy
        await sleep(2600);
        console.log('文章页读到一半 → state:', await mstate());
        await ev('labFollow()');
        await sleep(400);
        console.log('点跟随 → state:', await mstate());

        console.log('\n--- 状态切换是否影响待机动作池 ---');
        await ev("labState('sleepy')");
        await sleep(300);
        await ev("PetDebug['deepseek-pet'].director.cue('yawn')");
        await sleep(400);
        console.log('sleepy 池:', await pool(), '| act:', await ev("PetDebug['deepseek-pet'].player.name()"));

        console.log('\n--- 异常 ---');
        console.log(errors.length ? errors.slice(0, 5).join('\n') : '无');
    } finally {
        chrome.kill();
    }
})();
