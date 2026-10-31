/* 变量表与运行时对账：assets/vars.js 里写的键必须和 PetContent.vars 实际给的键一致。
 * 用法：node tools/manual/check-vars-doc.js <httpPort> <devtoolsPort>
 */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTTP_PORT = Number(process.argv[2] || 8504);
const DT_PORT = Number(process.argv[3] || 9633);
const BASE = 'http://127.0.0.1:' + HTTP_PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 在 Node 里跑一遍 assets/vars.js（它只依赖 window） */
function docKeys() {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'vars.js'), 'utf8');
    const sandbox = {};
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    const all = sandbox.PetVars.list;
    return {
        /* ctx 组是调用点临时传的，运行时本来就不提供，不算缺失 */
        required: all.filter((v) => v.group !== 'ctx').map((v) => v.key),
        ctx: all.filter((v) => v.group === 'ctx').map((v) => v.key)
    };
}

(async () => {
    const doc = docKeys();
    const required = doc.required;

    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
        '--window-size=1280,900', '--remote-debugging-port=' + DT_PORT,
        '--user-data-dir=' + __dirname + '\\..\\..\\.chrome-varsdoc', 'about:blank'], { stdio: 'ignore' });

    let ws;
    let id = 0;
    const pending = new Map();
    const send = (m, p) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
    const ev = async (e) => {
        const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) throw new Error('页面报错: ' + r.result.exceptionDetails.text);
        return r.result && r.result.result ? r.result.result.value : undefined;
    };

    try {
        let url;
        for (let i = 0; i < 60 && !url; i++) {
            try {
                const list = await (await fetch('http://127.0.0.1:' + DT_PORT + '/json/list')).json();
                const t = list.find((x) => x.type === 'page');
                if (t) url = t.webSocketDebuggerUrl;
            } catch (e) { /* retry */ }
            if (!url) await sleep(250);
        }
        ws = new WebSocket(url);
        await new Promise((r) => ws.addEventListener('open', r));
        ws.addEventListener('message', (e) => {
            const m = JSON.parse(e.data);
            if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
        });
        await send('Page.enable');
        await send('Runtime.enable');
        await send('Page.navigate', { url: BASE + '/demo.html' });
        await sleep(3500);

        const live = JSON.parse(await ev('JSON.stringify(Object.keys(PetContent.vars))'));
        const missingInRuntime = required.filter((k) => live.indexOf(k) < 0);
        const missingInDoc = live.filter((k) => required.indexOf(k) < 0);

        console.log('文档变量数:', required.length + doc.ctx.length,
            '(其中语境变量', doc.ctx.length + '个:', doc.ctx.join(', ') + ')',
            '| 运行时变量数:', live.length);
        console.log('文档有、运行时没有:', missingInRuntime.join(', ') || '无');
        console.log('运行时有、文档没写:', missingInDoc.join(', ') || '无');
        console.log('样例替换:', await ev("PetContent.fill('{greeting}，{pet} 在{pageName}陪你｜{time}｜{weekday}')"));

        process.exitCode = (missingInRuntime.length || missingInDoc.length) ? 1 : 0;
    } finally {
        try { chrome.kill(); } catch (e) { /* ignore */ }
    }
    process.exit(process.exitCode || 0);
})();
