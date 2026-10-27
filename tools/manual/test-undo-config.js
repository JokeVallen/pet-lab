const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9425);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || '8122');

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-uc',
        `${BASE}/config-editor.html`], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const send = (method, params) => new Promise((resolve) => {
        const myId = ++id;
        pending.set(myId, resolve);
        ws.send(JSON.stringify({ id: myId, method, params: params || {} }));
    });
    const ev = async (expression) => {
        const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) {
            return 'EXC: ' + (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || '');
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
        await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
        ws.addEventListener('message', (e) => {
            const m = JSON.parse(e.data);
            if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
        });
        await send('Runtime.enable');
        await sleep(2500);

        const state = () => ev("JSON.stringify({name: cfg.name, offX: cfg.shadow.offsetX, undoOff: document.getElementById('cfgUndoBtn').disabled, redoOff: document.getElementById('cfgRedoBtn').disabled, idx: history.index, stack: history.stack.length})");

        console.log('初始:', await state());

        // 改滑杆
        await ev("(function(){var r=document.querySelectorAll('.field input[type=range]')[0]; r.value=12; r.dispatchEvent(new Event('input'));})()");
        await sleep(700);
        console.log('改偏移后:', await state());

        await ev("undo()");
        console.log('撤销:', await state());
        await ev("redo()");
        console.log('重做:', await state());

        // 改名（文本输入，连续两次 → 一步）
        await ev("(function(){var i=document.querySelectorAll('.field input[type=text]')[0]; i.value='大肥鱼2'; i.dispatchEvent(new Event('input'));})()");
        await ev("(function(){var j=document.querySelectorAll('.field input[type=text]')[0]; j.value='大肥鱼3'; j.dispatchEvent(new Event('input'));})()");
        await sleep(700);
        console.log('改名后:', await state());
        await ev("undo()");
        console.log('撤销改名:', await state());

        // 分类新增
        const before = await ev("cfg.animations.categories.length");
        await ev("(function(){var b=[...document.querySelectorAll('button')].find(x=>/添加分类|Category/.test(x.textContent)); b.click();})()");
        console.log('分类数:', before, '→', await ev("cfg.animations.categories.length"), '| idx:', await ev("history.index"));
        await ev("undo()");
        console.log('撤销新增分类 → 分类数:', await ev("cfg.animations.categories.length"));

        // 恢复默认进历史
        await ev("window.confirm = () => true; resetAll()");
        console.log('恢复默认后:', await state());
        await ev("undo()");
        console.log('撤销恢复默认:', await state());

        // 输入框内 Ctrl+Z 不触发全局撤销
        await ev("(function(){var i=document.querySelectorAll('.field input[type=text]')[0]; i.focus();})()");
        const idxBefore = await ev("history.index");
        await ev("(function(){var i=document.activeElement; i.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true}));})()");
        await sleep(200);
        console.log('输入框内 Ctrl+Z:', idxBefore, '→', await ev("history.index"), '(应不变)');
    } finally {
        chrome.kill();
    }
})();
