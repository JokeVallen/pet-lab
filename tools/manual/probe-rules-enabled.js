const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9590);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8340);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,980',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-rules',
        BASE + '/rules-editor.html'], { stdio: 'ignore' });

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
        await sleep(4000);

        console.log('1) 板块标题:', await ev("[...document.querySelectorAll('.sechead h2')].map(h => h.textContent).join(' | ')"));
        console.log('2) 卡片数:', await ev("document.querySelectorAll('#list .rule').length"));
        console.log('3) 状态规则计数标签:', await ev("document.querySelector('.srule-card .top b').textContent"));

        // 停用第一条情境规则
        console.log('4) 关掉第 1 条:', await ev(`
            (function(){
                var boxes = [...document.querySelectorAll('#list .rule:not(.srule-card) .en input')];
                boxes[0].checked = false;
                boxes[0].dispatchEvent(new Event('change', {bubbles:true}));
                return boxes.length + ' 个开关，第一条 rule.enabled=' + JSON.stringify(rules[0].enabled);
            })()
        `));
        console.log('5) 卡片变灰:', await ev("document.querySelectorAll('#list .rule.is-off').length > 0"));
        console.log('6) YAML 里有 enabled: false:', await ev("document.getElementById('out').textContent.indexOf('enabled: false') >= 0"));
        console.log('7) 状态规则也能停用:', await ev(`
            (function(){
                var b = document.querySelector('#list .srrow .en input');
                b.checked = false; b.dispatchEvent(new Event('change', {bubbles:true}));
                return JSON.stringify(stateRules[0].enabled);
            })()
        `));
        console.log('8) 状态规则段也写了 enabled:', await ev("(document.getElementById('out').textContent.match(/state: .*\\n\\s+enabled: false/) || []).length > 0"));

        // 存一次，确认写进 YAML 且能编译
        console.log('9) 保存:', await ev("(function(){ saveRules(); return 'clicked'; })()"));
        await sleep(4000);
        console.log('   状态:', await ev("document.getElementById('status').textContent"));
        console.log('10) 文件里有 enabled: false:', await ev(`
            fetch('config/pet.yaml?ts='+Date.now(), {cache:'no-store'}).then(r=>r.text()).then(t => (t.match(/enabled: false/g)||[]).length)
        `));
    } finally {
        chrome.kill();
    }
})();
