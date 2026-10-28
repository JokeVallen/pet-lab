const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9610);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8360);
const PAGE = process.argv[4] || '/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-siteapi',
        BASE + PAGE], { stdio: 'ignore' });

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
        await sleep(5000);

        console.log('页面:', await ev('location.pathname'));
        console.log('SiteAPI 存在:', await ev('!!window.SiteAPI'));
        console.log('ready:', await ev('window.SiteAPI ? SiteAPI.ready().then(function(){return "ok"}).catch(function(e){return "ERR "+e.message}) : "none"'));
        console.log('health:', await ev('SiteAPI.health().then(function(h){return JSON.stringify({modules:h.modules, storage:h.storage})}).catch(function(e){return "ERR "+e.message})'));
        console.log('context:', await ev('SiteAPI.currentContext().then(function(c){return JSON.stringify(c)}).catch(function(e){return "ERR "+e.message})'));
        console.log('actions:', await ev('JSON.stringify(SiteAPI.actions().list().map(function(a){return a.id+":"+a.scope+(a.requiresConfirmation?"*":"")}))'));
        console.log('capabilities:', await ev('SiteAPI.capabilities().then(function(c){return c.capabilities.length + " 条, v" + c.apiVersion}).catch(function(e){return "ERR "+e.message})'));
        console.log('search 对象池:', await ev('SiteAPI.search().suggest("对象池", {limit: 3}).then(function(r){return JSON.stringify(r)}).catch(function(e){return "ERR "+e.message})'));
        console.log('content.search:', await ev('SiteAPI.content().search("对象池", {limit: 3}).then(function(r){return JSON.stringify(r.map(function(x){return x.type+":"+x.title.slice(0,20)}))}).catch(function(e){return "ERR "+e.message})'));
        console.log('reading.get:', await ev('JSON.stringify(SiteAPI.reading().get())'));
        console.log('userState 读写:', await ev('(function(){var u=SiteAPI.userState(); u.set("probe", {a:1}); var v=u.get("probe"); u.remove("probe"); return JSON.stringify(v);})()'));
    } finally {
        chrome.kill();
    }
})();
