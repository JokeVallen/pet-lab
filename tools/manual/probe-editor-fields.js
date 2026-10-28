const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9570);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8320);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-editor',
        BASE + '/config-editor.html'], { stdio: 'ignore' });

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

    const setField = (label, value, type) => ev(`
        (function(){
            var fields = [...document.querySelectorAll('.field')];
            var f = fields.find(function (x) {
                var n = x.querySelector('.name');
                return n && n.textContent.indexOf(${JSON.stringify(label)}) === 0;
            });
            if (!f) return '找不到字段 ' + ${JSON.stringify(label)};
            var input = f.querySelector('input');
            if (!input) return '字段里没有输入框';
            ${type === 'toggle'
                ? "input.checked = " + JSON.stringify(value) + "; input.dispatchEvent(new Event('change', {bubbles:true}));"
                : "input.value = " + JSON.stringify(String(value)) + "; input.dispatchEvent(new Event('input', {bubbles:true}));"}
            return '已设置 ' + ${JSON.stringify(label)} + ' = ' + input.value + (input.type === 'checkbox' ? ' (checked=' + input.checked + ')' : '');
        })()
    `);

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

        console.log('1) 改名字:', await setField('名字', '测试鱼'));
        console.log('2) 关拖拽:', await setField('允许拖拽', false, 'toggle'));
        console.log('3) 粒子数 = 5:', await setField('点击粒子数', 5, 'range'));
        console.log('4) 气泡停留 = 1200:', await setField('气泡停留', 1200, 'range'));

        await ev("document.querySelector('button.primary').click()");
        await sleep(4000);
        console.log('5) 保存状态:', await ev("document.getElementById('status').textContent"));

        console.log('6) YAML 里的关键值:', await ev(`
            fetch('config/pet.yaml?ts=' + Date.now()).then(r => r.text()).then(t => {
                var pick = function (re) { var m = t.match(re); return m ? m[0].trim() : '（没找到）'; };
                return JSON.stringify({
                    personaName: pick(/^\\s+name:\\s*测试鱼$/m),
                    topName: pick(/^name:\\s*.+$/m),
                    dragEnabled: pick(/^\\s+enabled:\\s*\\w+$/m),
                    particles: pick(/^\\s+particleCount:\\s*\\d+$/m),
                    bubbleTtl: pick(/^\\s+bubbleTtl:\\s*\\d+$/m)
                });
            })
        `));
    } finally {
        chrome.kill();
    }
})();
