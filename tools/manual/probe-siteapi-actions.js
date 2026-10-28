const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9613);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8363);
const PAGE = process.argv[4] || '/posts/2026/01/01/7bac37c2e8d2/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-siteapi3',
        BASE + PAGE], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const dialogs = [];
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
        ws.addEventListener('message', (e) => {
            const m = JSON.parse(e.data);
            if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
            if (m.method === 'Page.javascriptDialogOpening') {
                dialogs.push(m.params.message);
                send('Page.handleJavaScriptDialog', { accept: false });
            }
        });
        await send('Runtime.enable');
        await send('Page.enable');
        await sleep(4500);

        console.log('1) 手动 reading.save():', await ev('JSON.stringify(SiteAPI.reading().save())'));
        console.log('   reading.get():', await ev('JSON.stringify(SiteAPI.reading().get())'));

        console.log('2) 滚动事件是否自动保存:');
        await ev('window.scrollTo(0, Math.round(document.documentElement.scrollHeight*0.6))');
        await sleep(2200);
        console.log('   ', await ev('JSON.stringify(SiteAPI.reading().get())'));

        console.log('3) bookmark.toggle 走 actions.invoke（write-local，不要求确认）:');
        console.log('   ', await ev(`
            SiteAPI.actions().invoke('bookmark.toggle', {
                type: 'post', id: 'probe-post', title: '探针', path: '/probe/'
            }, {}).then(function(r){ return 'ok ' + JSON.stringify(r); }).catch(function(e){ return 'ERR ' + e.message; })
        `));
        console.log('   bookmarks.list:', await ev('JSON.stringify(SiteAPI.bookmarks().list().map(function(b){return b.key||b.id}))'));

        console.log('4) requiresConfirmation 的操作在不确认时:');
        console.log('   ', await ev(`
            SiteAPI.actions().invoke('data.clear', {}).then(function(r){ return 'ok ' + JSON.stringify(r); }).catch(function(e){ return 'ERR ' + e.message; })
        `));
        console.log('   弹窗:', dialogs.length ? dialogs.join(' | ').slice(0, 80) : '（无）');

        console.log('5) 第二次 content().list 是否缓存:');
        const t0 = Date.now();
        console.log('   ', await ev(`
            SiteAPI.content().list('document', { limit: 1 }).then(function(r){ return 'rows=' + r.length })
        `));
        console.log('   耗时(ms):', Date.now() - t0);

        console.log('6) navigation.open 是否走 pjax（仅记录事件，不真跳）:');
        console.log('   ', await ev(`
            (function(){
                var fired = null;
                var off = SiteAPI.events().on('navigation:open', function(d){ fired = d; });
                try { off && off(); } catch (e) {}
                return typeof SiteAPI.actions().invoke('navigation.open', {path: '/algorithm/'});
            })()
        `));
    } finally {
        chrome.kill();
    }
})();
