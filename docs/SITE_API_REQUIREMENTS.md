# 站点对接需求清单（给站点侧维护者）

> **消费者**：pet-lab 的桌宠（大肥鱼）。它**只**通过 `window.SiteAPI` 与站点对话，
> 不查 DOM、不读 `content-db` 内部表、不碰 `localStorage`。
> **依据**：`SITE_API_INTEGRATION_GUIDE.md`、`SITE_API.md`（v1.0.0）。
> **提出方**：宠物侧。**状态**：13 条，按优先级排列；P0 是性能/正确性问题，P1 是功能恢复，P2 是打磨。
> **英文版**：[SITE_API_REQUIREMENTS.en.md](SITE_API_REQUIREMENTS.en.md)

---

## 0. 宠物现在怎么用 SiteAPI（这是评估需求的前提）

宠物不抢首屏，调用顺序是固定的：

```js
// 1) 挂载时：只要上下文，不碰内容库
const ctx = await SiteAPI.currentContext();     // { type, id, title, path }

// 2) 6 秒后（site.readyDelayMs）：才 ready()
await SiteAPI.ready();                           // 因为 ready() 会拉 5.2 MB 的 content-db.json

// 3) ready 后 2 秒：文章元信息，按需、一页一次
const doc = await SiteAPI.content().list('document', { where: { path: ctx.path }, limit: 1 });
//    → doc.tags / doc.word_count（这一步触发全量内容库下载）

// 4) 滚动：订阅事件（依赖 ready() 里 SiteReadingPosition.start()）
SiteAPI.events().on('reading:position', row => { /* row.ratio */ });

// 5) 提问：检索
const rows = await SiteAPI.content().search('对象池', { limit: 3 });

// 6) 写：一律走 actions，且不伪造 confirmed
await SiteAPI.actions().invoke('bookmark.toggle', { type: 'post', id, title, path });
```

实测数据（本地构建产物，2026-10-28）：

| 指标 | 数值 |
| --- | --- |
| `content-db.json` 体积 | 5,265,124 B（约 5.2 MB，未压缩） |
| 首次 `content().list()`（本地 HTTP） | 约 60 ms，之后走内存缓存 |
| 站点 `ready()` 到内容库加载完成 | 依赖网络，本地 1–2 s |
| 宠物因此延迟 `ready()` | 6 s（可配） |
| 受影响的台词 | 滚动到底 / 回到顶部 / 标签页问候的前几秒 |

---

## 1. 需求总表

| ID | 优先级 | 一句话 | 现状 |
| --- | --- | --- | --- |
| R1 | P0 | `ready()` 拆成"轻量就绪"和"内容库加载" | 二者绑死，谁用 `reading` 都得先吞 5.2 MB |
| R2 | P0 | `currentContext()` 直接给 `tags` 与 `wordCount` | 只有 `type/id/title/path`，宠物得翻全量库 |
| R3 | P0 | `currentContext().contentId` 给内容库主键 | 现在只有 DOM 的 `article-container` |
| R4 | P0 | `currentContext().type` 区分 home / tag / category / 404 | 这些页都返回 `'page'`，宠物靠路径正则猜 |
| R5 | P1 | 上下文补 `theme: 'dark' \| 'light'` | 没有，主题相关台词全灭 |
| R6 | P1 | 上下文补 `comments: number` | 没有，两条评论相关规则永不触发 |
| R7 | P1 | 内容库支持预压缩 + 强缓存，或给轻量索引 | 每次 `no-cache` 重验证 5.2 MB |
| R8 | P1 | 搜索结果给可深链的信息 | question 行 `path` 恒为 `/questions/` |
| R9 | P2 | `actions().invoke` 失败带 `code` | 只有中文 message，消费者只能比字符串 |
| R10 | P2 | 明确 `ready()` 是否幂等 | 未说明；实测重复调用会重复注册 action |
| R11 | P2 | manifest 里列 `contextFields` 与 `actions` | 只有能力 id 列表 |
| R12 | P2 | 指南标注每个 action 在哪些页面注册 | 未标注（`navigation.*` 只在 `ready()` 后，`quiz.*` 只在试卷页） |
| R13 | P2 | `userState()` 的键、序列化与上限写进文档 | 行为可推断，但没有约定 |

---

## 2. 逐条说明

### R1 [P0] 把 `ready()` 拆成两段

**现状**：`SiteAPI.ready()` 同时做了三件事——`SiteContentAPI.ready()`（加载 5.2 MB 内容库 + 题库索引）、
`SiteReadingPosition.start()`、注册 `navigation.*` action。

**后果**：任何消费者只要想拿到"阅读位置"或"导航"，就必须先付出 5.2 MB 的代价。
宠物因此把 `ready()` 推迟到 6 秒后，**进页面头几秒的滚动完全感知不到**（`reading:position` 还没开始）。

**请求**：

```js
await SiteAPI.ready();            // 轻量：上下文、事件、阅读位置跟踪、action 注册
await SiteAPI.readyContent();     // 显式加载内容库（或 content().ensure()，现在已存在但被 ready 顺带调了）
```

或者给 `ready()` 一个开关：`SiteAPI.ready({ content: false })`。

**验收**：`ready()` 之后执行下面这行，结果应为空数组——

```js
performance.getEntriesByType('resource').filter(r => r.name.indexOf('content-db') >= 0)
```

---

### R2 [P0] 上下文直接带标签与字数

**现状**：宠物想回答"这篇和 Unity 有关"，得先 `content().list('document', { where: { path } })`，
这一步会把 5.2 MB 全量 JSON 拉下来解析。

**请求**：`currentContext()` 在 `post` 页返回

```js
{ type: 'post', id, contentId, title, path, tags: ['Unity', 'C#'], wordCount: 16186 }
```

`tags` 截到 12 个以内即可，`wordCount` 直接给 `documents.word_count`。

**收益**：宠物在文章页可以完全不碰内容库，只有用户真的提问时才检索。

**验收**：文章页 `await SiteAPI.currentContext()` 里 `tags.length > 0 && wordCount > 0`。

---

### R3 [P0] 给出内容库主键

**现状**：`currentContext().id` 返回 DOM 的 `article-container`（= `article.id`），
而内容库的文档 id 是 `post:_posts/游戏中的对象池技术探索（一）.md`。两者对不上，
宠物只能按 `path` 在全量表里线性查找。

**请求**：加 `contentId`（内容库主键），使得

```js
const doc = await SiteAPI.content().get('document', ctx.contentId);
```

一次命中，不需要 `list()`。试卷页可以顺带给 `paperId`。

**验收**：文章页 `content().get('document', ctx.contentId)` 返回的 `title` 与页面标题一致。

---

### R4 [P0] 页面类型要能区分

**现状**：`/`、`/tags/Unity/`、`/categories/Unity/`、`/404.html` 的 `type` 全是 `'page'`。
宠物只能拿 `path` 做正则匹配（`/^\/tags\//` 之类），等于把站点路由规则抄进了消费者。

**请求**：`type` 取值扩到
`'home' | 'post' | 'tag' | 'category' | '404' | 'page' | 'paper' | 'algorithm' | 'mock' | 'stats'`。

**验收**：

```js
// 在 /tags/Unity/ 打开控制台
(await SiteAPI.currentContext()).type   // 'tag'
```

---

### R5 [P1] 上下文补主题

**现状**：没有主题字段。宠物以前用 `MutationObserver` 盯 `data-theme`，按新规范已经删掉，
现在 `dark` 恒为 `null`，**两条主题台词（切深色/切浅色）不会出现**，`home.late` 也只能按小时判断。

**请求**：`currentContext()` 增加 `theme: 'dark' | 'light'`，并在切换主题时
`SiteEvents.emit('context:change', ctx)`（现在只有 pjax 时会发）。

**验收**：点主题按钮后 `(await SiteAPI.currentContext()).theme` 从 `'light'` 变 `'dark'`，
且控制台能收到一次 `context:change`。

---

### R6 [P1] 上下文补评论数（如果站点有评论）

**现状**：`comments` 恒为 `null`，"这篇没人评论"和"这篇讨论很热"两条规则永远不会命中。

**请求**：若站点接了评论系统，`currentContext()` 给 `comments: number`（没有就是 `0`，不是 `null`）。
**如果站点根本没有评论**，请明确说一声，宠物侧会删掉这两条规则，不再留死代码。

**验收**：文章页 `typeof ctx.comments === 'number'`。

---

### R7 [P1] 内容库的传输成本

**现状**：`/content-db.json` 5.2 MB，`fetch(url, { cache: 'no-cache' })`，
每次访问都要重新验证；本地 60 ms，线上按 1 MB/s 估算就是 5 秒级。

**请求**（任选其一，按站点条件）：

1. 预压缩 `.br` / `.gz` + `Cache-Control: public, max-age=86400, immutable`（配置即可，改动最小）；
2. 给一个轻量检索索引（`/search-index.json`：id/type/title/path/tags，几百 KB），
   详情仍走 `content().get()`；
3. 或把 `content-db.json` 按内容类型分片（documents / questions / cards 各一份）。

**验收**：DevTools Network 里 `content-db.json` 的 transfer size < 1 MB，且二次访问命中磁盘缓存。

---

### R8 [P1] 搜索结果要能深链

**现状**：`content().search()` 返回的 question 行，`path` 恒为 `/questions/`，
宠物只能把用户带到题库首页，不能带到那道题。

**请求**：搜索结果行带 `paperId` + `questionId`（或直接给含 hash 的可跳转 `path`），
让消费者能 `actions().invoke('navigation.openQuestion', { paperId, questionId })`。

**验收**：`(await SiteAPI.content().search('对象池', {limit:1}))[0]` 里能取到 `paperId` 与 `questionId`。

---

### R9 [P2] 失败要带错误码

**现状**：需要确认的操作在用户点取消后抛出

```js
Error('操作需要用户确认：data.clear')
```

宠物只能匹配这个中文字符串来区分"用户拒绝"和"真的失败了"，语言一改就断。

**请求**：给 `error.code`，例如 `'E_CONFIRM' | 'E_UNKNOWN_ACTION' | 'E_DENIED' | 'E_INVALID'`，message 保留。

**验收**：取消 `data.clear` 后，`catch (e)` 里 `e.code === 'E_CONFIRM'`。

---

### R10 [P2] `ready()` 的幂等性

**现状**：未文档化。实测重复调用会再次 `actions().register('navigation.open', …)`（覆盖，暂时无害），
但如果将来 `register` 改成抛错就会炸。

**请求**：明确"可重复调用、并发安全"，或内部加一个 `readyPromise` 缓存。

**验收**：连续 `await Promise.all([SiteAPI.ready(), SiteAPI.ready()])` 不报错，action 数不翻倍。

---

### R11 [P2] manifest 里给出契约细节

**现状**：`/site-api-manifest.json` 只有能力 id 与 scope。

**请求**：增加 `contextFields`（`currentContext()` 实际会返回哪些键）与 `actions`（当前页已注册的操作），
这样消费者可以在启动时判断"这个站点有没有 theme"，而不是猜。

**验收**：`await SiteAPI.manifest()` 里存在 `contextFields` 数组。

---

### R12 [P2] 标注 action 的可用页面

**现状**：`navigation.*` 是在 `ready()` 里才注册的，`quiz.*` 只在试卷页注册。
消费者在 `ready()` 之前调 `navigation.open` 会得到"未知操作：navigation.open"。

**请求**：在 `SITE_API_INTEGRATION_GUIDE.md` 的 action 表里加一列"可用页面/时机"：
`任何页面 · ready() 之后` / `仅试卷页` / `任何页面 · 随时`。

**说明**：宠物侧已经做了兜底——`navigation.open` 调用失败时退回 `SiteAPI.navigation().open(path)`，
但这属于绕路，不如把契约写清楚。

---

### R13 [P2] `userState()` 的约定

**现状**：写入对象能原样读回，但以下都没写：键名是否允许 `.`、单条上限、总配额、
`keys()` 是否存在、满了之后是抛错还是静默丢弃。

**请求**：在指南的第 17 节补上这几条。

**宠物侧现状**：只用 `pet.*` 前缀（`pet.state`、`pet.lang`、`pet.greeted`…），单条不超过 8 KB。

---

## 3. 可直接粘贴的自检脚本

在文章页控制台跑，一次看完 R1–R8 的状态：

```js
(async () => {
  const ctx = await SiteAPI.currentContext();
  console.log('context:', ctx);
  console.log('R2 tags/wordCount:', ctx.tags, ctx.wordCount);
  console.log('R3 contentId:', ctx.contentId,
    ctx.contentId ? await SiteAPI.content().get('document', ctx.contentId) : '缺失');
  console.log('R4 type:', ctx.type);
  console.log('R5 theme:', ctx.theme);
  console.log('R6 comments:', ctx.comments);
  console.log('R8 search row:', (await SiteAPI.content().search('对象池', { limit: 1 }))[0]);
  console.log('R11 manifest:', await SiteAPI.manifest());
})();
```

在标签页（`/tags/Unity/`）跑：

```js
(await SiteAPI.currentContext()).type   // 期望 'tag'
```

主题按钮点一下，再看 `theme` 是否变化、`context:change` 是否触发：

```js
SiteAPI.events().on('context:change', c => console.log('ctx changed', c.theme));
```

---

## 4. 明确不在请求范围内的

免得双方都花时间：

- **不要给宠物加专用接口**。宠物不需要 `PetContentAPI` 这类按消费者命名的东西，
  它要的只是通用能力。
- **不要让 API 感知访客身份**。收藏、笔记、阅读位置都按"本机"处理即可，不需要账号。
- **不需要宠物侧能读 DOM**。上面 R2–R6 都是为了让宠物**不必**读页面；
  给不出字段就明说，宠物会降级，而不是回去爬 DOM。
- **不需要 `content-db` 暴露原始 SQL**。`content().search/get/list` 已经够用。

---

## 5. 兼容与版本

- 本次需求都是**向后兼容的增量**（新字段 / 新错误码 / 新 manifest 项）；唯一的行为变化是 R1 拆分 `ready()`，
  建议保留旧签名：`ready()` 仍返回 Promise，只是不再加载内容库。
- 如果 R1 短期做不了，退而求其次：**给 `SiteReadingPosition.start()` 一个公开入口**
  （比如 `SiteAPI.reading().start()`），宠物就能在首屏开启滚动跟踪，不被迫提前 `ready()`。
- 做完任意一条，宠物侧都能独立验证，不需要改动接口形状。

---

## 6. 优先级建议

如果只能做三件事，按这个顺序：

1. **R1**（拆分 ready）：解除 5.2 MB 对阅读位置的绑架，宠物首屏就能跟踪滚动；
2. **R2 + R3**（上下文带 tags/wordCount/contentId）：文章页彻底不用拉内容库，省 5 MB / 次；
3. **R4**（类型细化）：把路由规则从消费者手里收回站点。

R5 / R6 决定两条主题台词和两条评论台词能不能复活；R7 决定线上首问的等待时间；
其余是契约清晰度问题，不修也能跑。
