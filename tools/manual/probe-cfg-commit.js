const PORT = Number(process.argv[2] || 9448);
const BASE = 'http://127.0.0.1:' + (process.argv[3] || 8193);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const send = (m, p) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
    await new Promise((r) => ws.addEventListener('open', r));
    await send('Runtime.enable');
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) return 'EXC ' + JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description);
        return r.result && r.result.result ? r.result.result.value : undefined;
    };

    console.log('占位图切换:', await ev(`
        (function(){
            var f = [...document.querySelectorAll('.field')].find(x => /占位图/.test(x.textContent));
            var s = f.querySelector('select');
            s.value = '/images/pet/anim/poster.webp';
            s.dispatchEvent(new Event('change'));
            return cfg.image;
        })()
    `));

    console.log('待机候选点选:', await ev(`
        (function(){
            var f = [...document.querySelectorAll('.field')].find(x => /常驻待机/.test(x.textContent));
            var chips = f.querySelectorAll('.chips.pick .chip');
            var before = cfg.animations.idle.slice();
            chips[3].click();
            return JSON.stringify({ before: before.length, after: cfg.animations.idle.length, on: chips[3].classList.contains('on') });
        })()
    `));

    console.log('状态池点选:', await ev(`
        (function(){
            var card = [...document.querySelectorAll('.card')].find(x => /状态/.test(x.querySelector('h2').textContent));
            var chip = [...card.querySelectorAll('.chips.pick .chip')].find(n => n.textContent === 'angry');
            var before = cfg.states.idle.pool.length;
            chip.click();
            return before + ' -> ' + cfg.states.idle.pool.length;
        })()
    `));

    console.log('颜色滑块:', await ev(`
        (function(){
            var f = [...document.querySelectorAll('.field')].find(x => /颜色/.test(x.textContent));
            var r = f.querySelector('input[type=range]');
            r.value = 40;
            r.dispatchEvent(new Event('input'));
            return cfg.shadow.color;
        })()
    `));

    console.log('拖拽动画改选:', await ev(`
        (function(){
            var f = [...document.querySelectorAll('.field')].find(x => /拖拽动画/.test(x.textContent));
            var s = f.querySelector('select');
            s.value = 'drag-up';
            s.dispatchEvent(new Event('change'));
            return cfg.animations.drag;
        })()
    `));
    ws.close();
})();
