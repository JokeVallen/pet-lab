const fs = require('fs');
const PORT = Number(process.argv[2] || 9416);
const BASE = 'http://127.0.0.1:' + (process.argv[3] || 8161);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const send = (m, p) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
    await new Promise((r) => ws.addEventListener('open', r));
    await send('Runtime.enable');
    await send('Page.enable');

    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
        if (r.result && r.result.exceptionDetails) return 'EXC';
        return r.result && r.result.result ? r.result.result.value : undefined;
    };

    // 回到演示页并等待就绪
    await send('Page.navigate', { url: BASE + '/index.html' });
    await sleep(4200);

    // 找到单帧图的缓存地址并确认可解码
    const info = await ev(`(function(){
        var e = performance.getEntriesByType('resource').map(function(r){ return r.name; });
        var png = e.filter(function(u){ return /assets\\/pet\\/.*\\.(webp|png)$/.test(u); });
        return JSON.stringify(png.slice(0, 4));
    })()`);
    console.log('素材候选:', info);

    // 逐像素比对：测试页画布上渲染视频首帧 vs 默认静态图
    const probe = await ev(`(function(){
        var root = document.getElementById('deepseek-pet');
        var vs = [].slice.call(root.querySelectorAll('.dp-video'));
        var v = vs.filter(function(x){ return x.classList.contains('is-front'); })[0] || vs[0];
        var c = document.createElement('canvas');
        c.width = 200; c.height = 177;
        var g = c.getContext('2d');
        try { g.drawImage(v, 0, 0, 200, 177); } catch (err) { return 'draw error: ' + err.message; }
        var d = g.getImageData(0, 0, 200, 177).data;
        var n = 0;
        for (var i = 3; i < d.length; i += 4) if (d[i] > 20) n++;
        return 'alpha>20 的像素比例: ' + (n / (200 * 177) * 100).toFixed(1) + '% | 视频尺寸: ' + v.videoWidth + 'x' + v.videoHeight;
    })()`);
    console.log('首帧解码:', probe);
    ws.close();
})();
