# 宠物 API 文档

> 面向要扩展宠物、接入新站点、或写自动化脚本的人。
> 模块之间只通过「意图」和「事件」通信，不直接调用。

---

## 1. 内核 `core.js`

```js
import { PetKernel } from './core.js';
```

### 1.1 事件总线

| 方法 | 说明 |
| --- | --- |
| `on(type, fn)` | 订阅，返回 `off()` |
| `emit(type, payload)` | 广播；监听器抛错不会影响其它监听器 |

内置事件：

| 事件 | 载荷 | 时机 |
| --- | --- | --- |
| `action` | `{ act, level, duration, token }` | 动作被接受 |
| `intent.rejected` | `{ act, level, by }` | 被更高优先级占用 |
| `action.hold` / `action.release` | `{ act }` | 持续状态开始 / 结束 |
| `speech.act` | `{ text, channel, priority, ttl }` | 请求说话 |
| `kernel.ready` | `{ modules }` | 装配完成 |

### 1.2 动作裁决

```js
PetKernel.action({ act: 'eat', level: 'direct', duration: 7000 });  // → boolean
PetKernel.hold({ act: 'drag' });      // 等价于 level='hold' 且不过期
PetKernel.release({ act: 'drag' });
PetKernel.busy();                     // → { act, level } | null
```

**级别是数值，名字只是约定**：

| 名字 | 值 |
| --- | --- |
| `ambient` | 1 |
| `scheduled` | 2 |
| `direct` | 3 |
| `hold` | 4 |

```js
PetKernel.level('direct');            // → 3
PetKernel.level(2.5);                 // → 2.5（任意数值都可用）
PetKernel.defineLevel('cinematic', 5);
```

规则：`当前占用级别 > 新请求级别` 时拒绝，并广播 `intent.rejected`。
`duration` 是**占用时长**，不是动画时长——动画多长由播放器自己知道。

### 1.3 模块装配

```js
PetKernel.register({
    id: 'my-module',
    requires: ['speech'],          // 依赖，按拓扑序装配
    provides: ['speech.voice'],    // 能力声明
    mount(ctx) { /* ... */ },      // 必需
    unmount() { /* 幂等 */ }
});

PetKernel.start();   // 可重复调用，只装配尚未挂载的模块
PetKernel.stop();
PetKernel.modules(); // → ['speech','actions',...]
PetKernel.log();     // 环形日志，200 条：mount / action / reject / error
```

### 1.4 挂载上下文 `ctx`

```js
{
    id,                        // 模块 id
    on, emit,                  // 总线
    action, hold, release, busy,
    speech(act),               // 等价于 emit('speech.act', act)
    store(ns),                 // 命名空间化的 localStorage：get/set/remove
    log
}
```

---

## 2. 语言通道 `modules/speech.js`

```js
import { PetSpeech } from './modules/speech.js';

const speech = PetSpeech.createSpeechModule({
    renderBubble(text, ttl) {},
    renderDialog(text) {},
    isDialogOpen() { return false; },
    dedupeMs: 8000,      // 同句防重
    maxQueue: 8
});
```

行为：

- 8 秒内相同文本直接丢弃，广播 `speech.dropped`
- 按 `priority` 排队：`reply(3) > context(2) > ambient(1)`
- `channel: 'auto'` 时，对话框开着走 dialog，否则走 bubble

---

## 3. 渲染器 `modules/renderers.js`

```js
import { PetRenderers } from './modules/renderers.js';

const bubble = PetRenderers.bubble(rootEl);        // (text, ttl) => void
const dialog = PetRenderers.dialog(logEl, { max: 10, onRendered });
PetRenderers.fillText(el, '结果：/knowledge/#tcp');  // 站内路径转 <a class="dp-link">
```

替换渲染器 = 换气泡样式、换成语音、换成弹幕。生产方不用改。

---

### 3.x 状态（states）

宠物只提供状态词汇，不判断何时进入。

```js
import PetConfig from './config.js';
PetConfig.states;          // { idle: { clip, pool, weight }, sleepy: {...}, busy: {...} }
```

| 方法 | 说明 |
| --- | --- |
| `PetAdapter.pickState(ctx)` | 先按 `policy.stateRules` 判断；都没命中时按 `states.*.weight` 加权，缺省 `idle` |
| `PetAdapter.holiday(date?)` | 按 `policy.calendar` 返回 `{ act, line }` 或 `null` |
| `ctx` | `{ page, type, tags, words, comments, scroll, dark, hour }` |

`policy` 是站点侧数据，换站点只改配置，宠物代码不动。未知状态一律降级到 `idle`。

`weight` 是可选的：不写就表示「只靠规则进入」；写了正值就参与没有规则命中时的随机抽取，`0` 等于不会随机出现。

`stateRules` 的 `when` 和 `rules.items` 用的是同一张算子表（见 7.1），所以两侧词汇一致。旧键名保留为别名，老配置无需改动：

| 旧键（stateRules 曾用） | 现在等价于 |
| --- | --- |
| `hourBelow` | `hourLt` |
| `hourFrom` | `hourGte` |
| `scrollFrom` | `scrollGte` |
| `scrollTo` | `scrollLte` |

两份配置的边界语义也一致（`Gte` / `Lte` 都是闭区间）。别名在适配层归一化一次，编译结果按 `when` 对象缓存，`pickState` 高频调用不会重复编译。

---

## 4. 动作端口 `modules/actions.js`

```js
import { PetActions } from './modules/actions.js';

const actions = PetActions.createActionsModule({
    play(act) {}, hold(act) {}, release(act) {}, setState(s) {}
});
```

订阅四个意图：

| 意图 | 载荷 |
| --- | --- |
| `intent.action` | `{ act, level, duration }` |
| `intent.state` | `{ state }` |
| `intent.hold` | `{ act }` |
| `intent.release` | `{ act }` |

---

## 5. 状态机 `modules/machine.js`

```js
import { PetMachine } from './modules/machine.js';

const m = PetMachine.createMachine({
    initial: 'idle',
    states: {
        idle: { pool: ['look', 'hum'] },
        'idle.sleepy': { pool: ['yawn'] },      // 不写 pool 则继承父级
        reading: { pool: ['think'] }
    },
    resolve: (ctx) => (ctx.hour >= 22 ? 'idle.sleepy' : 'idle')
});

m.sync(ctx);        // 按 resolve 迁移
m.set('reading');   // 手动迁移
m.state();          // → 'idle'
m.actions();        // → 当前状态的池子（沿父级继承）
m.parents('a.b.c'); // → ['a','a.b','a.b.c']
m.onEnter((next, prev) => {});
```

**加状态的成本**：只是往 `states` 里加一个键，`O(1)`，不涉及任何索引重建。
`resolve` 的复杂度决定迁移开销；池子查找沿父级链，深度通常是 2–3 层。

---

## 6. 分区 `modules/zones.js`

```js
import { PetZones } from './modules/zones.js';

const zones = PetZones.createZones({ zones: ZONES, map: ZONE_MAP, fallback: 'body' });

zones.hit(y, x);        // 归一化坐标 0~1 → 最细分区 id
zones.resolve(id);      // → { zone, rule } | null（沿父级链找映射）
zones.pickSay(rule);    // 支持 [{ t:'台词', w:2 }]
```

分区是**二维矩形**，坐标系归一化到 0~1，与角色图尺寸无关：

```js
{ id: 'head.crown.tip', xMin: 0.40, yMin: 0.00, xMax: 0.60, yMax: 0.05, parent: 'head.crown' }
```

- `xMin` / `xMax` 省略时表示占满整行宽度（省事，旧配置不用改）
- 同一父级下的子分区可以自由重叠，命中时**层级深的先中，同层面积小的先中**——结果不依赖书写顺序

命中测试是线性扫描。8 个分区约 1 µs；100 个分区仍在几十微秒量级，可忽略。

分区编辑器里可以直接在角色图上**框选出一个矩形**（点「＋ 框选新建」，或按住 Shift 拖），松手即成为新分区，右侧再设父级与反应。

**没写映射的分区不是错误**：自动回落父级，最终落 `fallback`，全都没有则返回 `null` 交给默认行为。

---

## 7. 规则 `modules/rules.js`

```js
import { PetRules } from './modules/rules.js';

const engine = PetRules.createEngine(rules, { cooldown: 25 });
engine.evaluate(ctx, env);   // → { id, say, act } | null
```

规则对象：

```js
{
    id: 'post.unity',
    when: (ctx, env) => ctx.page === 'post' && PetRules.matchTag(ctx.tags, ['unity']),
    say: '这篇和 Unity 有关……',      // 值或函数
    act: 'look',                      // 值或函数，null 表示不切动画
    cooldown: 25                      // 秒，覆盖引擎默认
}
```

数组顺序即优先级，第一条 `when` 为真即返回。函数抛异常会被吞掉并按不命中处理。

### 7.1 声明式条件与自定义算子

`PetRules.compileWhen(spec)` 把 `{ key: value }` 编译成断言函数。每个键对应算子表里的一条：

```js
PetRules.compileWhen({ page: 'post', wordsGt: 800 });
```

内置键（`getWhenKeys()` 返回，编辑器下拉同源）：

| 键 | 类型 | 含义 |
| --- | --- | --- |
| `page` / `type` | 文本 | 页面类型 / 细分类型 |
| `tagsAny` | 文本数组 | 任一标签包含即命中 |
| `wordsGt` / `wordsLt` | 数字 | 字数大于 / 小于（0 字不算短） |
| `commentsEq` / `commentsGte` | 数字 | 评论数等于 / 不少于 |
| `scrollGt` / `scrollLt` | 数字 | 阅读进度大于 / 小于 |
| `lastScrollGt` | 数字 | 距上次滚动超过（读 `env.lastScroll`） |
| `dark` | 布尔 | 暗色主题 |
| `hourGte` / `hourLt` | 数字 | 小时数 |
| `streakGte` | 数字 | 连续访问天数（读 `env.streak`） |

`PetRules.getWhenMeta()` 返回编辑器需要的全部信息（`{ key, kind, label, legacy }`），
两个编辑器的下拉都读它，不再各维护一份标签表。旧键名（`hourBelow` / `hourFrom` /
`scrollFrom` / `scrollTo`）以 `legacy: true` 的形式出现在列表末尾，显示为「小时 <（旧）」；
把它们改成新键时会带上原来的值，不会退化成 0。

要加条件，注册一条算子即可，配置和编辑器下拉都会自动跟上：

```js
PetRules.registerWhen('hasQuote', {
    kind: 'bool',                                  // bool / tags / text / number
    test: (ctx, value, env) => ctx.words > 100
});

// 之后配置里可以写
// when: { hasQuote: true }
```

- `test(ctx, value, env)` 返回真值即命中；抛异常按不命中处理。
- **未注册的键按不成立处理**（fail-closed）：拼错键名只会让规则永不命中，不会变成“无条件命中”。
- 编辑器启动时 `import()` 这个模块读 `getWhenKeys()`，因此注册过的键在下拉里就是“认识”的，不再报红。


---

## 8. 站点适配 `adapter.js`

新站点需要提供：

| 成员 | 返回 | 说明 |
| --- | --- | --- |
| `pageType()` | `'post' \| 'tag' \| 'category' \| 'home' \| '404' \| 'other'` | 页面类型 |
| `tags()` | `string[]` | 当前页标签/分类 |
| `wordCount()` | `number` | 正文字数 |
| `commentCount()` | `number` | 评论数 |
| `scrollRatio()` | `0~1` | 阅读进度 |
| `isDark()` | `boolean` | 主题 |
| `headingText()` / `tagFromPath()` | `string` | 标签页标题 |
| `rawGet/rawSet/rawRemove` | `string \| null` | 持久化 |
| `rules` | `Rule[]` | 情境规则表 |

宠物本体不出现任何站点选择器；换站点只重写这个文件。

---

## 9. 检索 `modules/search.js`

```js
import { PetSearch } from './modules/search.js';

const s = PetSearch.createSearch({ url: '/pet-index.json', say: (t) => {} });
s.matches('有没有讲 TCP 的');   // → boolean
s.ensure();                    // 懒加载索引
s.search(q);                   // → [{ r, score }]
s.answer(q);                   // → 回答文本（含 /path 链接）
s.rows();
```

索引格式（构建期生成）：

```json
{ "k": "post|card|page", "t": "标题", "u": "/path", "g": ["标签"],
  "c": ["分类"], "d": "2026-01-08", "w": 1234, "x": "摘要" }
```

---

## 10. 文案 `content/`

```js
import { PetContent } from './content/index.js';

PetContent.t('mood.sleeping');                 // 当前语言的一个字符串
PetContent.t('site.streak', { n: 3 });         // {name} 形式的变量替换
PetContent.pick('chat.fallback');              // 数组里随机取一条（同样支持变量）
PetContent.list('zone.tail');                  // 取整个数组（不改原数组）
PetContent.replies();                          // [{ id, re, lines }]，正则在取用时编译
PetContent.lang;                               // 'zh' | 'en'
PetContent.setLang('en');                      // 运行时切换，缺的键回落到中文
```

- 数据在 `content/zh.js`、`content/en.js`，形状一致；新增语言 = 新增一个文件 + 在 `content/index.js` 的 `PACKS` 里登记。
- 键路径用点号：`chat.replies`、`adapter.finished`、`search.kindCard`。
- 缺键时依次回落：当前语言 → 中文 → 返回键名本身（这样漏翻会显形，不会静默）。
- 正则类内容（`search.intent`、`site.patterns.*`）由调用方用 `new RegExp(...)` 编译，并按语言缓存。

---

## 11. 配置

```js
import PetConfig from './config.js';   // 由 config/pet.yaml 编译
```

字段见 `config/pet.yaml`，或打开 `config-editor.html` 可视化编辑。

### 11.1 角色可移植字段

换一只宠物只需要这几个键，运行时不写死任何角色：

| 键 | 类型 | 说明 |
| --- | --- | --- |
| `animDir` | 文本 | 动画目录，拼成 `animDir + clip + '.' + clipExt` |
| `clipExt` | 文本 | 动画扩展名，默认 `webm` |
| `image` | 文本 | 首帧占位图 |
| `hostId` | 文本 | DOM 挂载点 id，默认 `deepseek-pet` |
| `size` | `{width, height}` | 立绘框尺寸，写到 `--dp-w` / `--dp-h` |
| `accent` | `{primary, primary2, cyan}` | 主题色，写到同名 CSS 变量 |
| `persona` | 对象 | 全部台词与人设，见下 |

`persona` 的键：

```yaml
persona:
  name: 小橘                 # 聊天标题、aria-label、占位符都用它
  alt: 橘猫小橘              # 图片 alt
  icons: { feed: "🐟", restore: "🐱" }
  about: 自我介绍（聊天窗默认第一句）
  sleep: 睡着时说的话
  feed: [投喂台词…]          # 数组 = 随机取一条
  greet:
    late: [深夜问候…]        # 0–5 点
    morning: [上午问候…]     # 6–11
    afternoon: [下午问候…]   # 12–17
    evening: [晚上问候…]     # 18–23
  firstMeet: 第一次来
  again: 又见面了
  streak3: 又见面了，第 {n} 天。      # {n} 会被替换成连续天数
  streak7: 你来第 {n} 天啦。
  credit: 素材署名 HTML（可含链接）
```

取值走 `CONFIG.persona`，缺字段时用中性兜底，所以只写 `name` 也能跑。

---

## 12. 调试入口

```js
window.PetDebug.kernel   // 发意图、看日志
window.PetDebug.search   // 单独测检索
window.PetDebug.zones    // 分区命中
window.PetDebug[name]    // 每个实例一份：director / player / config / content / state
window.PetDebug[name].reply('你好')   // 直接走一遍"用户说 → 她回什么"
window.PetContent        // 文案层，可 setLang 切换
window.PetKernel         // 兼容快捷方式
```

分区可视化：页面加 `?pet-zone=1`，角色上会叠分区带，左下角显示当前分区 id。
