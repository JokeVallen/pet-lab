import { PetKernel as K } from '../../js/pet/core.js';

let pass = 0, fail = 0;
const ok = (c, n) => { c ? (pass++, console.log('  ok', n)) : (fail++, console.log('  FAIL', n)); };

console.log('1. 总线');
{
    const got = [];
    const off = K.on('ping', (p) => got.push(p));
    K.emit('ping', 1);
    off();
    K.emit('ping', 2);
    ok(got.length === 1 && got[0] === 1, 'emit/on/off 正常');
    K.on('boom', () => { throw new Error('x'); });
    K.emit('boom');
    ok(true, '监听器抛错不影响 emit');
}

console.log('2. 优先级裁决');
{
    const rejected = [];
    K.on('intent.rejected', (r) => rejected.push(r));
    ok(K.action({ act: 'eat', level: 'scheduled', duration: 7000 }), '先占 eat');
    ok(!K.action({ act: 'look', level: 'ambient', duration: 2000 }), '低级别被拒');
    ok(K.action({ act: 'drag.up', level: 'hold', duration: 1000 }), 'hold 可抢占');
    ok(K.busy().act === 'drag.up', 'busy 返回 hold');
    ok(rejected.length === 1, 'rejected 事件触发一次');
}

console.log('3. hold / release');
{
    const holds = [], rels = [];
    K.on('action.hold', (e) => holds.push(e.act));
    K.on('action.release', (e) => rels.push(e.act));
    ok(K.hold({ act: 'drag.hold' }), 'hold 成功');
    ok(K.release({ act: 'drag.down' }), 'release 成功');
    ok(K.busy() === null, '释放后不忙');
    ok(holds[0] === 'drag.hold' && rels[0] === 'drag.down', 'hold/release 事件正确');
}

console.log('4. 模块装配与生命周期');
{
    const order = [];
    K.register({ id: 'a', mount(c) { order.push('a'); c.on('ping', () => order.push('a:ping')); } });
    K.register({ id: 'b', requires: ['a'], mount(c) { order.push('b'); c.emit('ping'); } });
    let dup = false;
    try { K.register({ id: 'a', mount() {} }); } catch (e) { dup = true; }
    ok(dup, '重复注册被拒绝');
    K.register({ id: 'bad', mount() { throw new Error('boom'); } });
    K.start();
    ok(order.join(',') === 'a,b,a:ping', '按 requires 拓扑排序并 mount');
    ok(K.modules().length === 3, '模块列表正确');
    K.stop();
    ok(K.log().some((l) => l.kind === 'error'), '模块错误被记录');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
