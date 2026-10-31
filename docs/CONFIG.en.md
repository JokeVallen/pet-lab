# Configuration reference

> Every editable key in `config/pet.yaml`, its default, and where to change it.
> The list comes from the `config` table in `assets/vars.js`; `tools/check-config-doc.js`
> reconciles the two before a release, so a code change without a doc change fails the build.

## File shapes

Both are accepted; the runtime always sees one compiled config.

```yaml
# Single pet (legacy files keep working)
name: Whale
animDir: /images/pet/anim/
persona:
  name: Whale
```

```yaml
# Collection (several pets in one file; the active one gets compiled)
version: 1
active: whale
pets:
  - id: whale
    name: Whale
    config:
      name: Whale
      animDir: /images/pet/anim/
  - id: cat
    name: Cat
    config:
      name: Cat
      animDir: /images/pet/cat/
```

With a collection, every visual editor shows a "which pet" selector at the top; saving writes back
only the selected pet and leaves the others untouched.

## Who owns what

| Page | Owns |
| --- | --- |
| [Settings](config-editor.html) | identity / looks / rhythm / interaction / voice / UI / animation library / states / cooldown |
| [Zones](zone-editor.html) | clickable regions and each region's reaction |
| [Rules](rules-editor.html) | context rules and state rules |
| [Copy](copy-editor.html) | every `persona` line, in both languages |
| YAML only | just three keys below: roll weights and the holiday calendar |

## All fields

| Key | Meaning | Default | Where |
| --- | --- | --- | --- |
| `persona.name` | 对话标题与自称；文案里用 {pet} 引用 | （必填） | [Settings editor](config-editor.html) |
| `name` | 内部标识，只用于日志与兜底，改它不改称呼 | （必填） | [Settings editor](config-editor.html) |
| `storageKey` | 本机存档键；换掉会让访客记录、位置、聊天全部重置 | pet-v1 | [Settings editor](config-editor.html) |
| `hostId` | 挂载点 id；同页放多月实例时每只都要不同 | pet | [Settings editor](config-editor.html) |
| `animDir` | 透明动画目录，clip 名拼在它后面 | /images/pet/anim/ | [Settings editor](config-editor.html) |
| `image` | 首帧占位图；不支持 WebM 时也用它 | /images/pet/anim/poster.webp | [Settings editor](config-editor.html) |
| `shadow.offsetX` | 投影水平偏移，正数向右 | 0 | [Settings editor](config-editor.html) |
| `shadow.offsetY` | 投影垂直偏移，越大越"飘" | 6 | [Settings editor](config-editor.html) |
| `shadow.blur` | 投影模糊半径 | 10 | [Settings editor](config-editor.html) |
| `shadow.color` | 投影颜色（含透明度） | rgba(33,72,145,0.16) | [Settings editor](config-editor.html) |
| `clipExt` | 动画扩展名；播放器目前只吃 WebM | webm | [Settings editor](config-editor.html) |
| `size.width` | 立绘框宽，写进 CSS 变量 | 190 | [Settings editor](config-editor.html) |
| `size.height` | 立绘框高 | 169 | [Settings editor](config-editor.html) |
| `accent.primary` | 主题色主色 | #2f6fed | [Settings editor](config-editor.html) |
| `accent.primary2` | 主题色渐变末端 | #3f9bf5 | [Settings editor](config-editor.html) |
| `accent.cyan` | 点缀色（高亮、光晕） | #7ad9ff | [Settings editor](config-editor.html) |
| `idleRollMs` | 待机小动作的间隔区间 [最短, 最长]，毫秒 | [9000, 21000] | [Settings editor](config-editor.html) |
| `idleSleepMs` | 无操作多久后睡着，毫秒 | 150000 | [Settings editor](config-editor.html) |
| `drag.enabled` | 能不能拖起来 | true | [Settings editor](config-editor.html) |
| `drag.thresholdPx` | 移动超过多少像素才算拖拽（否则算点击） | 6 | [Settings editor](config-editor.html) |
| `click.particleCount` | 点击时飘出的粒子数量 | 6 | [Settings editor](config-editor.html) |
| `speech.bubbleTtl` | 气泡停留时长，毫秒 | 3200 | [Settings editor](config-editor.html) |
| `speech.contextTtl` | 情境台词气泡停留时长 | 6000 | [Settings editor](config-editor.html) |
| `speech.dedupeMs` | 同一句在这段时间内不重复说 | 45000 | [Settings editor](config-editor.html) |
| `speech.maxQueue` | 待说队列上限，积压超过就丢弃 | 3 | [Settings editor](config-editor.html) |
| `chat.maxMessages` | 对话框保留多少条历史 | 20 | [Settings editor](config-editor.html) |
| `ui.actionHideDelayMs` | 鼠标离开后多久收起动作按钮 | 320 | [Settings editor](config-editor.html) |
| `ui.actionFadeMs` | 动作按钮淡入淡出时长 | 140 | [Settings editor](config-editor.html) |
| `ui.wordsPerMinute` | 算「要读几分钟」用的每分钟字数 | 300 | [Settings editor](config-editor.html) |
| `rules.defaultCooldown` | 情境规则默认冷却，秒 | 60 | [Settings editor](config-editor.html) |
| `rules.items` | 情境规则条目（条件 → 台词 / 动作） | [] | [Rules editor](rules-editor.html) |
| `search.maxResults` | 站内检索最多返回几条 | 3 | [Settings editor](config-editor.html) |
| `animations.idle` | 常驻待机动画池 | [] | [Settings editor](config-editor.html) |
| `animations.clicks` | 被点时随机挑的动画池 | [] | [Settings editor](config-editor.html) |
| `animations.drag` | 抓起时播的动画 |  | [Settings editor](config-editor.html) |
| `animations.events.sleep` | 进入休眠时播一次 |  | [Settings editor](config-editor.html) |
| `animations.events.eat` | 投喂时播一次 |  | [Settings editor](config-editor.html) |
| `states.*` | 每种状态：clip、pool、weight、loop | idle / sleepy / busy | [Settings editor](config-editor.html) |
| `states.*.loop` | 只循环片段里的一段 [intro, end]，秒 | （整段循环） | [Settings editor](config-editor.html) |
| `zones` | 可点击区域：矩形、标签、层级 | [] | [Zone editor](zone-editor.html) |
| `zoneReactions` | 每个区域被点时的动作与台词 | {} | [Zone editor](zone-editor.html) |
| `persona.*` | 全部台词：自我介绍、睡觉、投喂、问候、图标 |  | [Copy editor](copy-editor.html) |
| `persona.en` | 英文台词层，缺的键回落到中文 | （无） | [Copy editor](copy-editor.html) |
| `policy.rollWeights` | 动作随机权重（按事件名） | {} | YAML only |
| `policy.stateRules` | 上下文 → 状态的映射 | [] | [Rules editor](rules-editor.html) |
| `policy.calendar` | 节假日等日历规则 | {} | YAML only |

## Applying changes

```bash
node tools/build-config.js          # config/pet.yaml → js/pet/config.js
```

Inside the editors, "Save & compile" does this for you:

`config/pet.yaml` → `js/pet-config.json` + `js/pet/config.js` → runtime `PetConfig`.

The runtime **deep-merges** over built-in defaults, so the file only needs the keys you want to
change; delete a key and it falls back to the default.
