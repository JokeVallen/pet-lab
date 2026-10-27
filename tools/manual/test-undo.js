const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9420);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || '8117');

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-uz',
        `${BASE}/zone-editor.html`], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const send = (method, params) => new Promise((resolve) => {
        const myId = ++id;
        pending.set(myId, resolve);
        ws.send(JSON.stringify({ id: myId, method, params: params || {} }));
    });
    const ev = async (expression) => {
        const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        return r.result && r.result.result ? r.result.result.value : r;
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

        const state = () => ev("JSON.stringify({n: zones.length, first: zones[0].id, disabledUndo: document.getElementById('undoBtn').disabled, disabledRedo: document.getElementById('redoBtn').disabled, stack: history.stack.length, idx: history.index})");

        console.log('初始:', await state());

        // 1) 新增分区 → 撤销 → 重做
        await ev("addZone()");
        console.log('新增后:', await state());
        await ev("undo()");
        console.log('撤销后:', await state());
        await ev("redo()");
        console.log('重做后:', await state());

        // 2) 拖动模拟：直接改坐标再 push（等价 pointerup）
        await ev("zones[0].y1 = 0.5; draw(); pushHistory();");
        console.log('改坐标后:', await state());
        await ev("undo()");
        console.log('撤销坐标:', await state());
        await ev("redo()");
        console.log('重做坐标:', await state());

        // 3) 删除 → 撤销
        await ev("delZone()");
        console.log('删除后:', await state());
        await ev("undo()");
        console.log('撤销删除:', await state());

        // 4) 输入合并：连续 schedulePush 只记一步
        await ev("document.getElementById('fAct').value='click-wave'; document.getElementById('fAct').dispatchEvent(new Event('input'));");
        await ev("document.getElementById('fAct').value='click-wave2'; document.getElementById('fAct').dispatchEvent(new Event('input'));");
        await sleep(700);
        console.log('连续输入后:', await state());
        await ev("undo()");
        console.log('撤销输入:', await ev("JSON.stringify({act: Object.values(reactions)[0].act, idx: history.index})"));

        // 5) 键盘快捷键
        await ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true}))");
        console.log('Ctrl+Z 后:', await state());
        await ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'y',ctrlKey:true,bubbles:true}))");
        console.log('Ctrl+Y 后:', await state());
    } finally {
        chrome.kill();
    }
})();
