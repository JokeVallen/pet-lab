const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9405);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8151);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-st2',
        `${BASE}/demo.html`], { stdio: 'ignore' });

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

    const probe = (expr) => ev(`(async () => {
        const { default: C } = await import('/js/pet/config.js');
        const { PetAdapter } = await import('/js/pet/adapter.js');
        return ${expr};
    })()`);

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
        await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
        ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
        await send('Runtime.enable');
        await send('Page.enable');
        await sleep(3500);

        console.log('宠物挂载:', await ev("typeof window.PetKernel"));
        console.log('状态词汇:', await probe("JSON.stringify(Object.keys(C.states))"));
        console.log('策略顺序:', await probe("JSON.stringify(C.policy.stateRules.map(r => r.state))"));
        console.log('日历条目:', await probe("Object.keys(C.policy.calendar).length"));
        console.log('深夜 →', await probe("PetAdapter.pickState({hour:3,dark:true,page:'other',scroll:0})"));
        console.log('白天文章中部 →', await probe("PetAdapter.pickState({hour:14,dark:false,page:'post',scroll:0.4})"));
        console.log('白天文章顶部 →', await probe("PetAdapter.pickState({hour:14,dark:false,page:'post',scroll:0})"));
        console.log('首页 →', await probe("PetAdapter.pickState({hour:14,dark:false,page:'home',scroll:0})"));
        console.log('元旦 →', await probe("JSON.stringify(PetAdapter.holiday(new Date(2026,0,1)))"));
        console.log('今天 →', await probe("JSON.stringify(PetAdapter.holiday())"));
        console.log('播放中的片段:', await ev("(document.querySelector('.dp-video.is-front') || {}).currentSrc || '(静态立绘)'"));
    } finally {
        chrome.kill();
    }
})();
