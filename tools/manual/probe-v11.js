const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9640);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8390);
const PAGE = process.argv[4] || '/posts/2026/01/01/7bac37c2e8d2/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-v11',
        BASE + PAGE], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const reqs = [];
    const send = (m, p) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) {
            const d = r.result.exceptionDetails.exception;
            return 'EXC ' + (d && d.description ? d.description.split('\n').slice(0, 2).join(' | ') : '');
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
        ws.addEventListener('message', (e) => {
            const m = JSON.parse(e.data);
            if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
            if (m.method === 'Network.requestWillBeSent') {
                const u = m.params.request.url.replace(BASE, '');
                if (/content-db|search-index|page-context|site-api-manifest/.test(u)) reqs.push(u);
            }
        });
        await send('Runtime.enable');
        await send('Network.enable');
        await sleep(9000);

        console.log('版本:', await ev('SiteAPI.version'));
        console.log('ready 前请求:', reqs.join(' | ') || '（无）');
        console.log('ready():', await ev("SiteAPI.ready().then(()=>'ok')"));
        await sleep(800);
        console.log('ready 后请求:', reqs.join(' | ') || '（无）');
        console.log('能力:', await ev("SiteAPI.capabilities().then(c=>JSON.stringify({v:c.apiVersion,fields:(c.contextFields||[]).length,actions:(c.actions||[]).length,caps:c.capabilities.length}))"));
        console.log('context:', await ev("SiteAPI.currentContext().then(c=>JSON.stringify(c))"));
        console.log('--- 不调 readyContent 直接搜 ---');
        console.log('search:', await ev("SiteAPI.content().search('对象池',{limit:2}).then(r=>JSON.stringify(r)).catch(e=>'ERR '+e.message)"));
        await sleep(800);
        console.log('搜索后请求:', reqs.join(' | '));
        console.log('--- 错误码 ---');
        console.log('未知操作:', await ev("SiteAPI.actions().invoke('nope.nope',{}).then(()=>'resolved').catch(e=>e.code + ' / ' + e.message)"));
        console.log('contentId 直取:', await ev("SiteAPI.currentContext().then(c=>c.contentId).then(id => SiteAPI.content().get('document', id)).then(d=>JSON.stringify(d && {t:(d.title||'').slice(0,12), tags:(d.data&&d.data.tags)}))"));
        console.log('userState:', await ev("JSON.stringify({keys: typeof SiteAPI.userState().keys, clear: typeof SiteAPI.userState().clear})"));
    } finally {
        chrome.kill();
    }
})();
