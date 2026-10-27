const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9474);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8217);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1200',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-r1',
        `${BASE}/rules-editor.html`], { stdio: 'ignore' });

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
        await sleep(3500);

        console.log('状态栏:', await ev("document.getElementById('status').textContent"));
        console.log('条件键数:', await ev("KEYS.length"));
        console.log('动画数:', await ev("CLIPS.length"));
        console.log('动作芯片:', await ev(`
            (function(){
                var p = document.querySelector('.acts .chips.pick');
                return p ? p.querySelectorAll('.chip').length + ' 个，已选 ' + p.querySelectorAll('.chip.on').length : '无';
            })()
        `));
        console.log('条件下拉选项:', await ev(`
            (function(){
                var s = document.querySelector('.cond select');
                return s ? s.options.length + ' 项，最后一项 ' + s.options[s.options.length-1].value : '无';
            })()
        `));

        // 动作点选写回
        console.log('act 改前:', await ev("JSON.stringify(rules.filter(r=>r.act).map(r=>[r.id,r.act]))"));
        console.log('点芯片:', await ev(`
            (function(){
                var r = rules.find(x => x.act && !Array.isArray(x.act));
                var idx = rules.indexOf(r);
                var card = document.querySelectorAll('.rule')[idx];
                var chip = [...card.querySelectorAll('.acts .chip')].find(c => c.textContent !== r.act);
                chip.click();
                return JSON.stringify(r.act);
            })()
        `));

        // 自定义条件
        console.log('选自定义:', await ev(`
            (function(){
                var card = document.querySelectorAll('.rule')[0];
                var sel = card.querySelector('.cond select');
                sel.value = '__custom';
                sel.dispatchEvent(new Event('change'));
                var keyIn = card.querySelector('.cond .keyin');
                var warn = card.querySelector('.cond .condwarn');
                return JSON.stringify({ 键名框显示: keyIn.style.display !== 'none', 警告显示: warn.style.display !== 'none' });
            })()
        `));

        await ev(`
            (function(){
                var card = document.querySelectorAll('.rule')[0];
                card.scrollIntoView({ block: 'start' });
            })()
        `);
        await sleep(300);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/rules-act.png', Buffer.from(shot.result.data, 'base64'));
    } finally {
        chrome.kill();
    }
})();
