const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9612);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8362);
const PAGE = process.argv[4] || '/posts/2026/01/01/7bac37c2e8d2/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-siteapi2',
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
        await send('Page.enable');
        await sleep(5000);

        console.log('页面:', await ev('location.pathname'));
        console.log('context:', await ev('SiteAPI.currentContext().then(c => JSON.stringify(c))'));
        console.log('context 有无 tags/words:', await ev('SiteAPI.currentContext().then(c => JSON.stringify({tags: c.tags, words: c.words, comments: c.comments}))'));

        console.log('--- 滚到底再看 reading ---');
        await ev('window.scrollTo(0, document.documentElement.scrollHeight)');
        await sleep(2500);
        console.log('reading.get:', await ev('JSON.stringify(SiteAPI.reading().get())'));

        console.log('--- 按 path 查 document（会拉 content-db.json）---');
        var t0 = Date.now();
        console.log('document:', await ev(`
            (function(){
                var path = SiteAPI.navigation().current().path;
                return SiteAPI.content().list('document', { where: { path: path }, limit: 1 })
                  .then(function(rows){
                      if (!rows.length) return 'no match';
                      var d = rows[0];
                      return JSON.stringify({id: d.id, title: d.title.slice(0,30), tags: d.tags, words: d.word_count, type: d.type});
                  })
                  .catch(function(e){ return 'ERR ' + e.message; });
            })()
        `));
        console.log('耗时(ms):', Date.now() - t0);

        console.log('--- 事件 ---');
        console.log('events 可用:', await ev('typeof SiteAPI.events().on'));
        console.log('navigation.current:', await ev('JSON.stringify(SiteAPI.navigation().current())'));
    } finally {
        chrome.kill();
    }
})();
