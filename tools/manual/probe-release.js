/* 发行包体检：抓控制台错误、HTTP 4xx、宠物是否挂上。
 * 用法：node tools/manual/probe-release.js <httpPort> <devtoolsPort> <page> [waitMs]
 */
'use strict';

const { spawn } = require('child_process');

const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTTP_PORT = Number(process.argv[2] || 8480);
const DT_PORT = Number(process.argv[3] || 9605);
const PAGE = process.argv[4] || 'demo.html';
const WAIT = Number(process.argv[5] || 6000);
const BASE = 'http://127.0.0.1:' + HTTP_PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,900',
        '--remote-debugging-port=' + DT_PORT,
        '--user-data-dir=' + __dirname + '\\..\\..\\.chrome-release',
        'about:blank'], { stdio: 'ignore' });

    let ws;
    let id = 0;
    const pending = new Map();
    const problems = [];
    const send = (m, p) => new Promise((res) => {
        const i = ++id;
        pending.set(i, res);
        ws.send(JSON.stringify({ id: i, method: m, params: p || {} }));
    });
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
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
        await new Promise((res) => ws.addEventListener('open', res));

        ws.addEventListener('message', (e) => {
            const m = JSON.parse(e.data);
            if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
            if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
                if (!/\/api\//.test(m.params.entry.url || '')) {
                    problems.push('log    ' + (m.params.entry.url || '?') + '  ' + m.params.entry.text.slice(0, 130));
                }
            }
            if (m.method === 'Runtime.exceptionThrown') {
                const d = m.params.exceptionDetails;
                problems.push('except ' + (d.url || '?') + ':' + d.lineNumber + '  ' +
                    ((d.exception && d.exception.description) || '').split('\n')[0]);
            }
            if (m.method === 'Network.responseReceived') {
                const r = m.params.response;
                /* /api/* 的 404 是预期：发行包通常放在纯静态托管下，没有本地服务。
                 * 页面自己探测并降级，这里不计为问题。 */
                const isApiProbe = /\/api\//.test(r.url);
                if (r.status >= 400 && !isApiProbe) problems.push('http' + r.status + ' ' + r.url);
            }
        });

        await send('Runtime.enable');
        await send('Log.enable');
        await send('Network.enable');
        await send('Page.enable');
        await send('Page.navigate', { url: BASE + '/' + PAGE });
        await sleep(WAIT);

        console.log('页面        : ' + await ev('location.pathname'));
        console.log('标题        : ' + await ev('document.title'));
        console.log('宠物已挂载  : ' + await ev("!!document.querySelector('.dp-root')"));
        console.log('角色可见    : ' + await ev("(function(){var e=document.querySelector('.dp-character');if(!e)return false;var r=e.getBoundingClientRect();return r.width>20&&r.height>20;})()"));
        console.log('测试面板存在: ' + await ev("!!document.getElementById('lab')"));
        console.log('首页卡片数  : ' + await ev("document.querySelectorAll('a.card').length"));
        console.log('问题数      : ' + problems.length);
        problems.forEach((p) => console.log('  ' + p));
    } finally {
        try { chrome.kill(); } catch (e) { /* ignore */ }
    }
    process.exit(0);
})();
