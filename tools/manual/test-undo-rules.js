const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9422);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || '8119');

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-ur',
        `${BASE}/rules-editor.html`], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const send = (method, params) => new Promise((resolve) => {
        const myId = ++id;
        pending.set(myId, resolve);
        ws.send(JSON.stringify({ id: myId, method, params: params || {} }));
    });
    const ev = async (expression) => {
        const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) return 'EXC: ' + JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description);
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
        await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
        ws.addEventListener('message', (e) => {
            const m = JSON.parse(e.data);
            if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
        });
        await send('Runtime.enable');
        await sleep(2500);

        const state = () => ev("JSON.stringify({n: rules.length, first: rules[0] && rules[0].id, undoOff: document.getElementById('undoBtn').disabled, redoOff: document.getElementById('redoBtn').disabled, idx: history.index, stack: history.stack.length})");

        console.log('初始:', await state());

        await ev("addRule()");
        console.log('新增规则:', await state());

        await ev("undo()");
        console.log('撤销新增:', await state());

        await ev("redo()");
        console.log('重做新增:', await state());

        await ev("rules.splice(0,1); render(); pushHistory();");
        console.log('删除首条:', await state());
        await ev("undo()");
        console.log('撤销删除:', await state());

        // 空条件行
        await ev("document.querySelectorAll('.rule')[0].querySelector('.add').click()");
        console.log('加条件:', await state());
        await ev("undo()");
        console.log('撤销加条件:', await state());

        // 连续输入合并
        const before = await ev("history.index");
        await ev("(function(){var a=document.querySelectorAll('.rule')[0].querySelector('textarea'); a.value='改一句\\n再一句'; a.dispatchEvent(new Event('input'));})()");
        await ev("(function(){var b=document.querySelectorAll('.rule')[0].querySelector('textarea'); b.value='再改一次'; b.dispatchEvent(new Event('input'));})()");
        await sleep(700);
        console.log('连续输入后 idx:', before, '→', await ev("history.index"), '| say:', await ev("JSON.stringify(rules[0].say)"));

        await ev("undo()");
        console.log('撤销输入后 say:', await ev("JSON.stringify(rules[0].say)"));

        // id 编辑不失焦
        await ev("(function(){var c=document.querySelectorAll('.rule')[0].querySelector('input.id'); c.focus(); c.value='post.demo'; c.dispatchEvent(new Event('input'));})()");
        console.log('id 编辑后 activeElement:', await ev("document.activeElement.tagName + '.' + document.activeElement.className + ' value=' + document.activeElement.value"));
    } finally {
        chrome.kill();
    }
})();
