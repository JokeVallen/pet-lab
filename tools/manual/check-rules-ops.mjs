import { PetRules, WHEN_KEYS } from '../../js/pet/modules/rules.js';

const ctx = (o) => Object.assign({ page: 'post', type: '', tags: [], words: 0, comments: 0, scroll: 0, dark: false, hour: 12 }, o);

// 1) 内置条件照旧
console.log('内置键数:', WHEN_KEYS.length);
console.log('page 命中:', PetRules.compileWhen({ page: 'post' })(ctx({})));

// 2) 未知键 fail-closed
console.log('未知键:', PetRules.compileWhen({ nope: 1 })(ctx({})), '(应为 false)');

// 3) 注册一个自定义条件
PetRules.registerWhen('hasQuote', {
    kind: 'bool',
    test: (c) => c.page === 'post' && c.words > 100
});
console.log('注册后键数:', PetRules.getWhenKeys().length);
console.log('hasWhen(hasQuote):', PetRules.hasWhen('hasQuote'), 'kind:', PetRules.whenKind('hasQuote'));
console.log('命中(长文):', PetRules.compileWhen({ hasQuote: true })(ctx({ words: 500 })));
console.log('不命中(短文):', PetRules.compileWhen({ hasQuote: true })(ctx({ words: 50 })));

// 4) 未知键与已知键混用
console.log('混合:', PetRules.compileWhen({ page: 'post', nope: 1 })(ctx({})), '(应为 false)');

// 5) 引擎层面：自定义条件能驱动命中
const engine = PetRules.createEngine([
    { id: 'q', when: PetRules.compileWhen({ hasQuote: true }), say: '引用一下。', cooldown: 0 }
]);
console.log('引擎命中:', JSON.stringify(engine.evaluate(ctx({ words: 800 }), {})));
console.log('引擎未命中:', engine.evaluate(ctx({ words: 10 }), {}));

// 6) 参数校验
try { PetRules.registerWhen('', {}); } catch (e) { console.log('空名被拒:', e.message); }
try { PetRules.registerWhen('x', {}); } catch (e) { console.log('无 test 被拒:', e.message); }
