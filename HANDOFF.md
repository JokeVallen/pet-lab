> **注意**：本文记录的是重构**开始前**的状态与踩坑史。
> 重构已完成，当前架构见 [STATUS.md](STATUS.md)。

# 宠物项目 · 交接文档

> 用途：把已完成的工作、踩过的坑和未完成的目标交给新的工作区 / 新对话。
> 日期：2026-10-25
> 当前工作区：`D:\Users\User\pet-lab`（宠物本体），博客仓库：`D:\Users\User\Blogs`

---

## 1. 目标

把博客宠物「大肥鱼」（鲸鱼娘）从**与 Hexo 强耦合的单体脚本**重构为**可移植、可插拔的独立系统**。

设计意向（已确认）：

```
站点（数据 + 交互） ──信号──▶ 中介者（映射规则） ──意图──▶ 宠物
```

- 宠物 = **动作**（必需）+ **语言**（可选）+ 其它可选模块
- 站点 = 纯信号源，与宠物互不影响、各自独立扩展
- 换站点只重写适配器，宠物核心不改

---

## 2. 目标架构（四层）

```
pet-core      内核：装配 / 事件总线 / 调度 / 持久化 / 插槽
actions       动作模块：HFSM 状态机 + 双缓冲播放器（必需）
speech        语言模块：speech act 总线 + 气泡 / 对话框渲染器（可选）
adapter       站点适配：把站点数据与交互翻译成规范化信号
```

依赖方向严格单向：`adapter → 信号 → 规则 → 意图 → 模块`。

### 三条硬约束（血泪换来，务必保留）

1. **模块不能直接改宠物状态。** 想动身体发 `intent.action`，想说话发 `speech.act`，由内核按优先级裁决。
2. **单一身体所有权。** 同一时刻只能有一个模块驱动动作，冲突时输方收到 `intent.rejected`。（本项目历史上"鼠标靠近打断吃饭"就是没这条约定造成的。）
3. **HFSM 是动作模块的内部实现**，对外只暴露意图，不暴露状态。

### 中断级别（建议保留）

| 级别 | 例子 | 能否被打断 |
| --- | --- | --- |
| `hold` | 拖拽、按住 | 最高，打断一切 |
| `direct` | 用户点击、喂食 | 可打断 scheduled/ambient |
| `scheduled` | 状态机排的动作 | 仅被上两级打断 |
| `ambient` | 待机小动作、情境配动作 | 随时可被打断 |

### 模块接口（草案）

```ts
interface PetModule {
  id: string;
  requires?: string[];
  provides?: string[];      // 能力声明，如 'action.float'
  mount(ctx: Kernel): void;
  unmount?(): void;         // 必须幂等
}
```

内核 ≤ 300 行、插槽 ≤ 5 个、**不做沙箱和动态下载**。模块就是 ES 模块导出的普通对象。

### speech act（语言解耦的关键）

生产方只发文本意图，渲染器各自订阅：

```ts
bus.emit('speech.act', {
  text: '这篇够看一阵的。',
  channel: 'auto',      // auto | bubble | dialog | voice
  priority: 'context',  // reply > context > ambient
  ttl: 5000
});
```

接 LLM 只是换"文本生产者"，渲染层一行不用改；加语音只是加一个订阅者。

---

## 3. 当前状态（已验证）

`pet-lab` 已完成：

```
pet-lab/
├─ demo.html                演示页 + 信号模拟面板
├─ README.md                 运行方式与目标
├─ js/deepseek-pet.js        宠物本体（1450 行，单体，尚未拆分）
├─ css/deepseek-pet.css      样式
└─ images/pet/anim/          32 段 WebM（4.55 MB）+ poster.webp
```

启动：

```powershell
python -m http.server 8080 --directory "D:\Users\User\pet-lab"
```

**验收结果**：空白页面上宠物成功挂载（`#deepseek-pet` 存在），两个 `<video>` 的 `data-clip` 为 `drag` / `click-happy`，对话输入框存在。
说明：宠物**自挂载**（监听 `DOMContentLoaded` 自己 init），不依赖博客的 `ensurePet()` 加载器。

### 尚未做的重构

代码仍是原样拷贝，仍在直接读 `location`、`document`、`localStorage`。播放器 / 状态机 / 上下文规则 / 对话 UI 全在一个 IIFE 里。

---

## 4. 现有功能清单（重构后需保持行为等价）

### 4.1 动作库（32 段，4.55 MB）

| 分组 | 名称 |
| --- | --- |
| 待机 | `idle`、`sleep` |
| 拖拽 | `drag`、`drag-up`、`drag-hold`、`drag-down` |
| 点击 | `click-happy`、`click-shy`、`click-wave` |
| 小动作 | `look`、`hum`、`tail`、`bubbles`、`stretch`、`yawn`、`doze` |
| 进食 | `eat` |
| 扩展 | `spin`、`bow`、`puzzle`、`surprised`、`angry`、`proud`、`sad`、`code`、`think`、`dance`、`fireworks`、`mooncake`、`santa`、`magic`、`cheerful` |

**拖拽语义拆分**（重要）：
- `drag-up`（2.6 s）按下播放，停在末帧
- `drag-hold`（3.7 s）循环，模拟悬空
- `drag-down`（3 s）松手播放，结束回待机

### 4.2 状态机（当前为扁平版）

```
idle ──暗色&&≥22点 / 凌晨<6点──▶ sleepy
  └──文章页 && 滚动 12%~92% ──▶ reading
```

池子：`idle`（look/hum/tail/bubbles/stretch/cheerful/magic/puzzle）、`reading`（hum/look/doze/think/code）、`sleepy`（yawn/doze/look/sad）。

### 4.3 交互

| 操作 | 反应 |
| --- | --- |
| 点脑袋（上 42%） | `click-shy` + 台词 |
| 点身体 | 随机点击回应（85%）+ 爱心（75%）+ 台词（70%） |
| 点尾巴（下 14%） | `tail` + 泡泡 |
| 按住拖拽 | `drag-up` → `drag-hold` 循环 |
| 松开 | `drag-down` → 待机 |
| 喂 🍚 | `eat` + 米饭台词 |
| Enter / 空格 | 等同点击 |

点击与拖拽的区分：`pointerdown`+`pointerup` 位移阈值 6px。**click 事件不参与判定**（否则松手会被当成摸头）。

### 4.4 上下文信号（现存于 `runContext()` 的 if/else 链）

- 页面类型：首页 / 文章 / 标签页 / 分类页 / 404
- 文章标签（Unity、算法 → 针对性台词）
- 字数（>4000 提醒、<600 说很快读完）
- 评论数（0 条 / ≥3 条）
- 滚动到底 → 抬头 + "读到底了"
- 滚回顶部 → 伸懒腰 + "回到开头了"
- 深夜 / 暗色主题 → 状态池切换
- 节日（8 个）→ 专属台词 + 动作
- 连续访问天数（1 / 3 / 7+）
- 首次 vs 再来（`sessionStorage` + `state.seen`）

### 4.5 对话（四层应答）

```
页面上下文回答 → 全站索引检索 → 固定句库（22 组） → 兜底
```

- 上下文回答：能力清单、当前文章标签 + 阅读时长、时间、标签数、连续访问
- 全站检索：词表见 §5，结果带**可点击链接**
- 中文分词：二字滑窗 + 停用词过滤
- 打分：标题 6 / 标签 4 / 分类 3 / 摘要 2

---

## 5. 全站索引（属于 adapter 层）

生成脚本：`D:\Users\User\Blogs\scripts\pet-index.js`（Hexo generator）
产物：`/pet-index.json`

```
353 条：post 156 + card 193 + page 4
146 KB（gzip ≈ 40 KB）
```

记录结构：

```json
{"k":"post|card|page","t":"标题","u":"/访问路径","g":["标签"],
 "c":["分类"],"d":"2026-01-08","w":1234,"x":"110字摘要"}
```

要点：
- 知识卡片来自 `source/knowledge/cards/*.md`（手工解析 front-matter），深链格式 `/knowledge/#<card-id>`
- 排除：`/questions/UnityClient/...`（答题 SPA，正文是倒计时噪音）、字数 < 80 的空壳页、404
- 运行时**懒加载**：页面加载 5 秒后静默预取（`force-cache`）

**重构时**：这个生成器应跟着 adapter 走，不属于宠物本体。

---

## 6. 素材工艺（重做素材时照抄参数）

源素材：`D:\Download\dsh-pet-main\dsh-pet-main\dsh-pet\assets\webm`（106 段，51.8 MB）

统一转码（320×283，裁剪原图 380×336 的 (112,4) 区域）：

```
ffmpeg -c:v libvpx-vp9 -i <src> -vf "setpts=PTS/1.35,crop=380:336:112:4,scale=320:283:flags=lanczos" \
  -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 -b:v 0 -crf 50 -an <out>
```

- **加速 1.35 倍**（`setpts`）优于截断：保留完整动作弧线，不会切掉收势
- 解码必须 `-c:v libvpx-vp9` **在 `-i` 之前**，否则 alpha 通道丢失
- 亮度校正：对偏差明显的片段加 `eq=brightness=(111.6-当前亮度)/255`，并补 `-color_range pc`
- 已校正：`spin` `santa` `code` `angry` `fireworks`（亮度现集中在 105–116）

---

## 7. 踩过的坑（每一行都对应一次真实故障）

| 现象 | 真因 |
| --- | --- |
| 气泡一个都不出来 | `sayMaybe` 被调用但从未定义（字符串替换 MISS 后没核对） |
| 松手后一直悬空 | `justDragged` 未声明，`pointerup` 一进来就抛异常，`drop()` 没执行 |
| 上传/回顶规则全失效 | `lastScrollSeen` 未声明，`runContext()` 整段中断 |
| 节日当天不问候 | `dayAct[mdKey]` 里 `mdKey` 未定义 |
| 拖拽 3.6 秒后突然站立 / 吃饭被打断 | `drop()` 的安全网定时器跨动作残留 |
| 第二次拖拽白屏 | "重新预热"逻辑会把已换到前台的元素 `pause()` |
| 拖拽有 100–300ms 空白 | `promote()` 里无条件 `currentTime = 0` 触发 seek，`readyState` 从 4 掉到 1 |
| 按住时反复"升起" | `hold()` 用了循环播放，应播一次停在末帧 |
| 松手被识别为摸头 | `pointerup` 和 click 委托双重触发 |
| 每次都说"第一次见" | `streak === 1` 被当成"首次访问"；且整页跳转不触发 pjax |
| 对话卡在"让我翻一下索引" | 异步补答只 `say()` 到气泡，没 `appendMessage` 到对话 |
| 素材明暗不一 | 源素材批次不同 + 编码未写 `-color_range` |

**教训**：
- 字符串替换改代码必须**先断言目标串存在**，MISS 就中止整次修改
- `node --check` 只查语法，查不出未定义变量——改完要 grep 关键符号的定义与引用
- 遇到"没反应"先看控制台报错，不要靠猜

---

## 8. 未解决问题

1. **拖拽首次延迟 100–200 ms**：两块 `<video>` 装不下"常驻待用 + 播放中"，要根治需第三块屏（专供 drag 常驻）
2. **规则表未数据化**：11 条情境规则散在 if/else 链，无法排序、冷却、单测
3. **台词硬编码**：`REPLIES` / `siteAwareReply` / `greet` 里的文本未抽成短语包
4. **检索无同义词**：搜"协程"找不到英文标题的 Coroutine 卡片
5. **`state.visits` 不存在**：累计访问次数未实现（文档早期提过，实为误记）

---

## 9. 下一步（建议顺序）

1. **只做第 1 步：抽出 adapter**——把所有 `location` / `document.querySelector` / `localStorage` 收敛到一个文件，其余不动。风险最低，做完能一眼看清宠物还剩多少站点依赖。
2. 内核 + 动作模块（HFSM 搬入，对外只留意图）
3. speech act 总线 + 气泡 / 对话框两个渲染器
4. **空页面验收**：假适配器让宠物在空白 HTML 上跑起来
5. 之后才谈网页交互、听歌等扩展模块

---

## 10. 验证方法（照抄可用）

**挂载检查**（无头 Chrome）：

```powershell
python -m http.server 4421 --directory pet-lab
chrome --headless=new --disable-gpu --no-sandbox --virtual-time-budget=5000 --dump-dom http://127.0.0.1:4421/
```

看 DOM 里是否有 `id="deepseek-pet"`、`data-clip` 是否已填。

**交互延迟测量**（CDP + `Runtime.evaluate`）：派发 `pointerdown` 后轮询 `video.is-front` 的 `data-clip` 与 `readyState`，用 `performance.now()` 计时。注意：`readyState` 会误导，真实感知要看首帧绘制。

**注意**：无头 Chrome 默认上报 `prefers-reduced-motion: reduce`。本项目**不得**因该偏好停止播放或屏蔽内容，否则在用户机器上会整只静止（已踩过）。

---

## 11. 授权

代码 MIT。动画素材**非商用**，需署名 + 保留上游仓库链接（见博客仓库 `PET_CREDITS.md`，角色设计：ZipZipPipe / 上善无形，CC BY-NC-SA 4.0）。挂广告或接受赞助前必须先处理授权。
