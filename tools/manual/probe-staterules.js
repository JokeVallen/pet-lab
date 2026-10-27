const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9463);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8223);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1200',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-sr',
        `${BASE}/config-editor.html`], { stdio: 'ignore' });

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
        await new Promise((res) => ws.addEventListener('open', res));
        ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
        await send('Runtime.enable');
        await send('Page.enable');
        await sleep(4000);

        const card = `[...document.querySelectorAll('.card')].find(x => /鐘舵€佽鍒?.test(x.querySelector('h2').textContent))`;

        console.log('鍏冩暟鎹?', await ev("WHEN_META.length + ' 椤癸紝鍚棫閿?' + WHEN_META.filter(m=>m.legacy).length"));
        console.log('瑙勫垯琛?', await ev(`${card} ? ${card}.querySelectorAll('.srule').length : 'NO CARD'`));
        console.log('鏉′欢琛?', await ev(`${card} ? ${card}.querySelectorAll('.cond').length : '-'`));
        console.log('涓嬫媺椤?', await ev(
            `${card} ? JSON.stringify([...${card}.querySelectorAll('.srule')[0].querySelectorAll('.cond select')].map(s => s.value)) : '-'`));
        console.log('鐩爣鐘舵€?', await ev(
            `${card} ? [...${card}.querySelectorAll('.srule-head select')].map(s => s.value).join(',') : '-'`));

        // 鏀逛竴涓€?鈫?YAML 璺熺潃鍙?        console.log('鏀瑰€煎墠:', await ev("JSON.stringify(cfg.policy.stateRules[0])"));
        await ev(`${card}.querySelectorAll('.srule')[0].querySelector('.cond input').focus()`);
        await ev(`
            (function(){
                var c = ${card};
                var inp = c.querySelectorAll('.srule')[0].querySelector('.cond input');
                inp.value = '4';
                inp.dispatchEvent(new Event('input'));
            })()
        `);
        console.log('鏀瑰€煎悗:', await ev("JSON.stringify(cfg.policy.stateRules[0])"));

        // 鎶婃棫閿崲鎴愭柊閿?        console.log('鎹㈤敭鍓?', await ev("JSON.stringify(cfg.policy.stateRules[0])"));
        await ev(`
            (function(){
                var c = ${card};
                var sel = c.querySelectorAll('.srule')[0].querySelector('.cond select');
                sel.value = 'hourLt';
                sel.dispatchEvent(new Event('change'));
            })()
        `);
        console.log('鎹㈤敭鍚?', await ev("JSON.stringify(cfg.policy.stateRules[0])"));
        console.log('涓嬫媺鏄剧ず:', await ev(
            `${card}.querySelectorAll('.srule')[0].querySelector('.cond select').selectedOptions[0].textContent`));

        // 娣诲姞涓€鏉?        await ev(`${card}.querySelector('.card footer button, footer button') ? ${card}.querySelector('footer button').click() : 0`);
        await sleep(200);
        console.log('鍔犲悗鏉℃暟:', await ev("cfg.policy.stateRules.length"));

        await ev(`${card}.scrollIntoView({ block: 'start' })`);
        await sleep(300);
        const box = JSON.parse(await ev(`
            (function(){
                var c = ${card}.getBoundingClientRect();
                return JSON.stringify({ x: Math.round(c.left), y: Math.round(c.top + window.scrollY), w: Math.round(c.width), h: Math.min(520, Math.round(c.height)) });
            })()
        `));
        const shot = await send('Page.captureScreenshot', {
            format: 'png',
            clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 2 },
            captureBeyondViewport: true
        });
        fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/config-staterules.png', Buffer.from(shot.result.data, 'base64'));
    } finally {
        chrome.kill();
    }
})();

