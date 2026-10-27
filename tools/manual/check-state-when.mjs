import { PetRules } from '../../js/pet/modules/rules.js';

const ctx = (o) => Object.assign({ page: 'other', type: '', tags: [], words: 0, comments: 0, scroll: 0, dark: false, hour: 12 }, o);

// 模拟 adapter 的别名 + 缓存逻辑
const WHEN_ALIAS = { hourBelow: 'hourLt', hourFrom: 'hourGte', scrollFrom: 'scrollGte', scrollTo: 'scrollLte' };
const norm = (w) => { const o = {}; Object.keys(w).forEach((k) => { o[WHEN_ALIAS[k] || k] = w[k]; }); return o; };
const match = (w, c) => PetRules.compileWhen(norm(w))(c, {});

console.log('新键 scrollGte:', PetRules.hasWhen('scrollGte'), 'keys:', PetRules.getWhenKeys().length);

// 旧 stateRules 三条
const oldRules = [
    { when: { hourBelow: 6 }, state: 'sleepy' },
    { when: { dark: true }, state: 'sleepy' },
    { when: { scrollFrom: 0.9 }, state: 'busy' }
];
console.log('夜里 3 点:', match(oldRules[0].when, ctx({ hour: 3 })));
console.log('上午 10 点:', match(oldRules[0].when, ctx({ hour: 10 })));
console.log('暗色:', match(oldRules[1].when, ctx({ dark: true })));
console.log('进度 0.9（边界应命中 >=）:', match(oldRules[2].when, ctx({ scroll: 0.9 })));
console.log('进度 0.89:', match(oldRules[2].when, ctx({ scroll: 0.89 })));

// 新词汇等价
console.log('hourLt 等价:', match({ hourLt: 6 }, ctx({ hour: 3 })) === match({ hourBelow: 6 }, ctx({ hour: 3 })));
console.log('scrollGte 等价:', match({ scrollGte: 0.9 }, ctx({ scroll: 0.9 })) === match({ scrollFrom: 0.9 }, ctx({ scroll: 0.9 })));
console.log('scrollLte 等价:', match({ scrollLte: 0.5 }, ctx({ scroll: 0.5 })) === match({ scrollTo: 0.5 }, ctx({ scroll: 0.5 })));

// 新词汇可以表达以前做不到的
console.log('新组合 page+hourGte+scrollLt:', match({ page: 'post', hourGte: 8, scrollLt: 0.2 }, ctx({ page: 'post', hour: 9, scroll: 0.1 })));
console.log('未知键 fail-closed:', match({ hourBellow: 6 }, ctx({ hour: 3 })), '(拼错的键应 false)');
