import { PetRules as R } from '../../js/pet/modules/rules.js';

let pass = 0, fail = 0;
const ok = (c, n) => { c ? (pass++, console.log('  ok', n)) : (fail++, console.log('  FAIL', n)); };

const e = R.createEngine([
    { id: 'a', when: (c) => c.type === 'post', say: 'A', cooldown: 60 },
    { id: 'b', when: (c) => c.type === 'tag', say: (c, v) => 'tag:' + v.name, act: 'hum', cooldown: 0 },
    { id: 'c', when: () => true, say: 'C', cooldown: 0 }
]);

ok(e.evaluate({ type: 'post' }, {}).say === 'A', '第一条命中即返回');
ok(e.evaluate({ type: 'post' }, {}).say === 'C', '规则冷却后落到兜底规则');
const t = e.evaluate({ type: 'tag' }, { name: 'Unity' });
ok(t.say === 'tag:Unity' && t.act === 'hum', '函数式 say/act');
ok(R.matchTag(['C#'], ['unity', 'c#']) === true, 'matchTag 大小写不敏感');
ok(R.matchTag([], ['x']) === false, '空标签不命中');
ok(R.matchTag(['数据库'], ['算法']) === false, '无关标签不命中');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
