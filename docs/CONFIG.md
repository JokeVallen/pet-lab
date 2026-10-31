# 配置项参考 / Configuration reference

> 本文列出 `config/pet.yaml` 的**全部**可改项、默认值与在哪里改。
> 清单由 `assets/vars.js` 的 `config` 表生成，`tools/check-config-doc.js` 会在发版前对账：
> 代码改了而文档没跟上，构建就会失败。

## 文件形态

两种都支持，运行时看到的是同一份编译产物。

```yaml
# 单只（老文件，照旧）
name: 小鲸
animDir: /images/pet/anim/
persona:
  name: 小鲸
```

```yaml
# 合集（多只共用一份文件，编译时挑 active 那只）
version: 1
active: whale
pets:
  - id: whale
    name: 小鲸
    config:
      name: 小鲸
      animDir: /images/pet/anim/
  - id: cat
    name: 小橘
    config:
      name: 小橘
      animDir: /images/pet/cat/
```

合集形态下，四个可视化编辑器顶部都会出现「编辑哪一只」的下拉框；保存时只写回选中的那一只，
其余原样保留。

## 谁负责哪一块

| 页面 | 管什么 |
| --- | --- |
| [配置编辑器](config-editor.html) | 身份 / 外观 / 节奏 / 交互 / 语言 / 界面 / 动作库 / 状态 / 冷却 |
| [分区编辑器](zone-editor.html) | 可点击区域与每区的反应 |
| [规则编辑器](rules-editor.html) | 情境规则条目、状态规则 |
| [文案编辑器](copy-editor.html) | `persona` 的全部台词（中英） |
| 手改 YAML | 只有下面标「手改 YAML」的三项：动作随机权重、节假日日历 |

## 全部字段

| 键 | 含义 | 默认 | 在哪改 |
| --- | --- | --- | --- |
| `persona.name` | 对话标题与自称；文案里用 {pet} 引用 | （必填） | [配置编辑器](config-editor.html) |
| `name` | 内部标识，只用于日志与兜底，改它不改称呼 | （必填） | [配置编辑器](config-editor.html) |
| `storageKey` | 本机存档键；换掉会让访客记录、位置、聊天全部重置 | pet-v1 | [配置编辑器](config-editor.html) |
| `hostId` | 挂载点 id；同页放多月实例时每只都要不同 | pet | [配置编辑器](config-editor.html) |
| `animDir` | 透明动画目录，clip 名拼在它后面 | /images/pet/anim/ | [配置编辑器](config-editor.html) |
| `image` | 首帧占位图；不支持 WebM 时也用它 | /images/pet/anim/poster.webp | [配置编辑器](config-editor.html) |
| `shadow.offsetX` | 投影水平偏移，正数向右 | 0 | [配置编辑器](config-editor.html) |
| `shadow.offsetY` | 投影垂直偏移，越大越"飘" | 6 | [配置编辑器](config-editor.html) |
| `shadow.blur` | 投影模糊半径 | 10 | [配置编辑器](config-editor.html) |
| `shadow.color` | 投影颜色（含透明度） | rgba(33,72,145,0.16) | [配置编辑器](config-editor.html) |
| `clipExt` | 动画扩展名；播放器目前只吃 WebM | webm | [配置编辑器](config-editor.html) |
| `size.width` | 立绘框宽，写进 CSS 变量 | 190 | [配置编辑器](config-editor.html) |
| `size.height` | 立绘框高 | 169 | [配置编辑器](config-editor.html) |
| `accent.primary` | 主题色主色 | #2f6fed | [配置编辑器](config-editor.html) |
| `accent.primary2` | 主题色渐变末端 | #3f9bf5 | [配置编辑器](config-editor.html) |
| `accent.cyan` | 点缀色（高亮、光晕） | #7ad9ff | [配置编辑器](config-editor.html) |
| `idleRollMs` | 待机小动作的间隔区间 [最短, 最长]，毫秒 | [9000, 21000] | [配置编辑器](config-editor.html) |
| `idleSleepMs` | 无操作多久后睡着，毫秒 | 150000 | [配置编辑器](config-editor.html) |
| `drag.enabled` | 能不能拖起来 | true | [配置编辑器](config-editor.html) |
| `drag.thresholdPx` | 移动超过多少像素才算拖拽（否则算点击） | 6 | [配置编辑器](config-editor.html) |
| `click.particleCount` | 点击时飘出的粒子数量 | 6 | [配置编辑器](config-editor.html) |
| `speech.bubbleTtl` | 气泡停留时长，毫秒 | 3200 | [配置编辑器](config-editor.html) |
| `speech.contextTtl` | 情境台词气泡停留时长 | 6000 | [配置编辑器](config-editor.html) |
| `speech.dedupeMs` | 同一句在这段时间内不重复说 | 45000 | [配置编辑器](config-editor.html) |
| `speech.maxQueue` | 待说队列上限，积压超过就丢弃 | 3 | [配置编辑器](config-editor.html) |
| `chat.maxMessages` | 对话框保留多少条历史 | 20 | [配置编辑器](config-editor.html) |
| `ui.actionHideDelayMs` | 鼠标离开后多久收起动作按钮 | 320 | [配置编辑器](config-editor.html) |
| `ui.actionFadeMs` | 动作按钮淡入淡出时长 | 140 | [配置编辑器](config-editor.html) |
| `ui.wordsPerMinute` | 算「要读几分钟」用的每分钟字数 | 300 | [配置编辑器](config-editor.html) |
| `rules.defaultCooldown` | 情境规则默认冷却，秒 | 60 | [配置编辑器](config-editor.html) |
| `rules.items` | 情境规则条目（条件 → 台词 / 动作） | [] | [规则编辑器](rules-editor.html) |
| `search.maxResults` | 站内检索最多返回几条 | 3 | [配置编辑器](config-editor.html) |
| `animations.idle` | 常驻待机动画池 | [] | [配置编辑器](config-editor.html) |
| `animations.clicks` | 被点时随机挑的动画池 | [] | [配置编辑器](config-editor.html) |
| `animations.drag` | 抓起时播的动画 |  | [配置编辑器](config-editor.html) |
| `animations.events.sleep` | 进入休眠时播一次 |  | [配置编辑器](config-editor.html) |
| `animations.events.eat` | 投喂时播一次 |  | [配置编辑器](config-editor.html) |
| `states.*` | 每种状态：clip、pool、weight、loop | idle / sleepy / busy | [配置编辑器](config-editor.html) |
| `states.*.loop` | 只循环片段里的一段 [intro, end]，秒 | （整段循环） | [配置编辑器](config-editor.html) |
| `zones` | 可点击区域：矩形、标签、层级 | [] | [分区编辑器](zone-editor.html) |
| `zoneReactions` | 每个区域被点时的动作与台词 | {} | [分区编辑器](zone-editor.html) |
| `persona.*` | 全部台词：自我介绍、睡觉、投喂、问候、图标 |  | [文案编辑器](copy-editor.html) |
| `persona.en` | 英文台词层，缺的键回落到中文 | （无） | [文案编辑器](copy-editor.html) |
| `policy.rollWeights` | 动作随机权重（按事件名） | {} | 手改 YAML |
| `policy.stateRules` | 上下文 → 状态的映射 | [] | [规则编辑器](rules-editor.html) |
| `policy.calendar` | 节假日等日历规则 | {} | 手改 YAML |

## 改完怎么生效

```bash
node tools/build-config.js          # config/pet.yaml → js/pet/config.js
```

在可视化编辑器里点「保存并编译」即可，不必手跑：

`config/pet.yaml` → `js/pet-config.json` + `js/pet/config.js` → 运行时 `PetConfig`。

运行时与内置默认值**深合并**，所以文件里只需要写想改的键；删掉某个键就回落到默认值。
