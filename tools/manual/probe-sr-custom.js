const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9482);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8240);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1200',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-sr5',
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

        console.log('状态下拉最后一项:', await ev(`
            (function(){
                var s = document.querySelector('.srrow .cond select');
                return s.options[s.options.length - 1].value + ' / ' + s.options[s.options.length - 1].textContent;
            })()
        `));

        // 选「自定义…」→ 出现键名输入和警告
        console.log('选自定义:', await ev(`
            (function(){
                var row = document.querySelector('.srrow .cond');
                var sel = row.querySelector('select');
                sel.value = '__custom';
                sel.dispatchEvent(new Event('change'));
                return JSON.stringify({
                    键名框: row.querySelector('.keyin').style.display !== 'none',
                    警告: row.querySelector('.condwarn').style.display !== 'none',
                    聚焦: document.activeElement === row.querySelector('.keyin')
                });
            })()
        `));

        // 填一个未注册的键
        console.log('改成 myCustom:', await ev(`
            (function(){
                var row = document.querySelector('.srrow .cond');
                var inp = row.querySelector('.keyin');
                inp.value = 'myCustom';
                inp.dispatchEvent(new Event('change'));
                return JSON.stringify(stateRules[0].when);
            })()
        `));
        console.log('导出:', await ev("toYaml().split('\\n').find(l => /myCustom/.test(l))"));
        console.log('重建后仍是自定义行:', await ev(`
            (function(){
                var row = document.querySelector('.srrow .cond');
                return row.querySelector('select').value + ' / 键名框可见 ' + (row.querySelector('.keyin').style.display !== 'none');
            })()
        `));

        // 注册同名键 → 警告应消失
        console.log('注册后:', await ev(`
            (function(){
                RUNTIME.registerWhen('myCustom', { kind: 'bool', test: function (c) { return !!c.flag; } });
                render();
                var row = document.querySelector('.srrow .cond');
                return JSON.stringify({
                    下拉值: row.querySelector('select').value,
                    键名框隐藏: row.querySelector('.keyin').style.display === 'none',
                    警告隐藏: row.querySelector('.condwarn').style.display === 'none'
                });
            })()
        `));

        // 撤销回来
        await ev("undo()");
        console.log('撤销后:', await ev("JSON.stringify(stateRules[0].when)"));

        await ev(`
            (function(){
                var row = document.querySelector('.srrow .cond');
                row.scrollIntoView({ block: 'center' });
            })()
        `);
        await sleep(300);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/rules-staterules-custom.png', Buffer.from(shot.result.data, 'base64'));
    } finally {
        chrome.kill();
    }
})();
