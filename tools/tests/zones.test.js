import { PetZones as Z } from '../../js/pet/modules/zones.js';

let pass = 0, fail = 0;
const ok = (c, n) => { c ? (pass++, console.log('  ok', n)) : (fail++, console.log('  FAIL', n)); };

const zones = [
    { id: 'head', yMin: 0, yMax: 0.42 },
    { id: 'head.crown', yMin: 0, yMax: 0.14, parent: 'head' },
    { id: 'body', yMin: 0.42, yMax: 0.86 },
    { id: 'body.fin', yMin: 0.55, yMax: 0.74, xMin: 0, xMax: 0.35, parent: 'body' },
    { id: 'tail', yMin: 0.86, yMax: 1 }
];
const map = {
    head: { act: 'click-shy', say: ['乖乖'] },
    'body.fin': { act: 'spin' },
    tail: { act: 'tail', say: [{ t: '痒', w: 3 }, { t: '别碰', w: 1 }] }
};
const e = Z.createZones({ zones, map, fallback: 'body' });

ok(e.hit(0.05, 0.5) === 'head.crown', '子分区优先命中');
ok(e.hit(0.20, 0.5) === 'head', '子分区之外落回父级');
ok(e.hit(0.60, 0.20) === 'body.fin', '带 x 范围的子分区命中');
ok(e.hit(0.60, 0.80) === 'body', 'x 超出范围时落回 body');
ok(e.hit(0.95, 0.5) === 'tail', '尾部命中');
ok(e.resolve('head.crown').rule.act === 'click-shy', '无映射时回落父级映射');
ok(e.resolve('body.fin').rule.act === 'spin', '自身映射优先');
ok(e.resolve('body') === null, '全链无映射返回 null');
ok(e.resolve('tail').zone === 'tail', 'resolve 返回命中分区');
const say = e.pickSay(map.tail);
ok(say === '痒' || say === '别碰', '带权重的台词可抽取');

/* 二维：自定义矩形、同深度重叠时小的优先 */
const custom = Z.createZones({
    zones: [
        { id: 'face', xMin: 0.2, yMin: 0.1, xMax: 0.8, yMax: 0.5 },
        { id: 'face.eye', xMin: 0.3, yMin: 0.15, xMax: 0.45, yMax: 0.25 },
        { id: 'hud', xMin: 0.0, yMin: 0.0, xMax: 0.1, yMax: 0.1 }
    ],
    map: { face: { act: 'a' }, 'face.eye': { act: 'b' }, hud: { act: 'c' } },
    fallback: 'face'
});
ok(custom.hit(0.2, 0.35) === 'face.eye', '二维子矩形命中');
ok(custom.hit(0.2, 0.6) === 'face', '矩形内、子矩形外落回父级');
ok(custom.hit(0.6, 0.5) === null, '矩形之外不命中');
ok(custom.hit(0.05, 0.05) === 'hud', '独立小矩形命中');

const overlap = Z.createZones({
    zones: [
        { id: 'big', xMin: 0, yMin: 0, xMax: 1, yMax: 1 },
        { id: 'small', xMin: 0.4, yMin: 0.4, xMax: 0.6, yMax: 0.6 }
    ],
    map: {}, fallback: 'big'
});
ok(overlap.hit(0.5, 0.5) === 'small', '同深度重叠时面积小的优先');
ok(overlap.hit(0.1, 0.1) === 'big', '重叠区之外命中大矩形');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
