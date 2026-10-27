const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9421);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8168);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,1000',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-zn',
        `${BASE}/zone-editor.html`], { stdio: 'ignore' });

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
        for (let i = 0; i < 60 && !url; i++) {
            try {
                const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
                const p = list.find((t) => t.type === 'page');
                if (p) url = p.webSocketDebuggerUrl;
            } catch (e) { /* retry */ }
            if (!url) await sleep(250);
        }
        ws = new WebSocket(url);
        await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', res); });
        ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
        await send('Runtime.enable');
        await send('Page.enable');
        await sleep(2500);

        console.log('分区数:', await ev("zones.length"));
        console.log('父分区选项:', await ev("[...document.getElementById('fParent').options].map(o=>o.textContent).join(' / ')"));
        console.log('动作选项数:', await ev("document.getElementById('fAct').options.length"));
        console.log('动作前 5:', await ev("[...document.getElementById('fAct').options].slice(0,5).map(o=>o.textContent).join(' / ')"));

        // 新建子分区
        await ev("addZone()");
        await sleep(300);
        console.log('新建后 id:', await ev("zones[zones.length-1].id"), '| parent:', await ev("zones[zones.length-1].parent || '(顶层)'"));

        // 用下拉改父分区
        await ev("(function(){var s=document.getElementById('fParent');s.value='body';s.dispatchEvent(new Event('change'));})()");
        await sleep(300);
        console.log('改父级后:', await ev("zones[zones.length-1].parent"));

        // 下拉选动作
        await ev("(function(){var s=document.getElementById('fAct');s.value='click-wave';s.dispatchEvent(new Event('change'));})()");
        await sleep(200);
        console.log('动作写入:', await ev("reactions[zones[zones.length-1].id].act"));

        // 横向范围
        await ev("(function(){var c=document.getElementById('fFull');c.checked=false;c.dispatchEvent(new Event('change'));})()");
        await sleep(200);
        console.log('取消占满后:', await ev("JSON.stringify({x0:zones[zones.length-1].x0,x1:zones[zones.length-1].x1})"));

        // 校验 id 重复
        await ev("(function(){var f=document.getElementById('fId');f.value='head';f.dispatchEvent(new Event('input'));})()");
        await sleep(200);
        console.log('重复 id 错误提示:', await ev("document.getElementById('idErr').style.display"), '| 是否写回:', await ev("zones[zones.length-1].id"));

        // 导出检查
        console.log('导出含新分区:', await ev("fullYaml().indexOf('zone.new') >= 0 || fullYaml().indexOf('.new') >= 0"));
    } finally {
        chrome.kill();
    }
})();
