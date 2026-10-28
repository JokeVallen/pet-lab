# 宠物实验室（pet-lab）

鲸鱼娘宠物「大肥鱼」的独立工具集。**不依赖 Hexo / Butterfly**，只靠一个静态服务器就能跑；接进任何站点只改一个适配层。

> 只想把它装到自己的博客？直接下发行版：[Releases · v1.0.0](https://github.com/JokeVallen/pet-lab/releases/latest)
> （只含运行时、素材、配置与许可）。这个 `main` 分支是开发环境，含编辑器、测试与探针。

## 页面

双击 `home.html` 即可，也可以单独打开：

| 页面 | 用途 |
| --- | --- |
| `home.html` | 统一入口 |
| `index.html` | 宠物演示 + 测试面板（动作 / 状态 / 睡眠 / 说话 / 提问 / 语言 / 配置读数） |
| `config-editor.html` | 她**是什么**：外观 / 节奏 / 语言 / 动作库 / 状态（clip、池、权重） |
| `zone-editor.html` | 身体分区：二维框、鼠标反应、外观与底图 |
| `rules-editor.html` | 她**何时做什么**：状态规则（条件 → 状态）+ 情境规则（条件 → 台词 / 动作），每条可单独停用 |
| `docs.html` | Markdown 阅读器，中英文档都能看 |
| `tests.html` | 测试面板：8 个套件可单跑，也能一键全跑 |

### 分工：一个字段只在一个页面里改

| 配置项 | 唯一归属 | 别的页面 |
| --- | --- | --- |
| `animations.*` | `config-editor` | 只读展示，不提供入口 |
| `states.*`（`clip` / `pool` / `weight`） | `config-editor` | 规则页不再显示权重 |
| `policy.stateRules` | `rules-editor` | 配置页只管 `states` 定义，不碰规则 |
| `policy.calendar` | 手改 YAML | 两个编辑器都不碰 |
| `zones` / `zoneReactions` | `zone-editor` | — |
| `rules.items` | `rules-editor` | 导出只含 `policy.stateRules` + `rules.items` |

两条界线：

- **状态是词汇，规则是行为。** 状态长什么样（clip、池、权重）在配置页定；它什么时候被选中，是规则页的事。所以 `policy.stateRules` 归规则页，和 `rules.items` 并排放——两类规则都是“条件 → 结果”，只是结果不同。
- **导出不能越界。** 规则页导出只包含 `policy.stateRules` 和 `rules.items`，不再捎带 `states`（那会覆盖 clip/池/权重）。

### 保存前会先看一眼磁盘

三个编辑器都是「在浏览器里改、写回同一个 `config/pet.yaml`」，天然存在一种事故：页面是十分钟前打开的，这期间文件被别的标签页或手工改过，点保存就把它整份盖掉。现在的做法是：

| 页面 | 保存方式 | 保护 |
| --- | --- | --- |
| `config-editor` | 整份 YAML 覆盖 | 打开时记内容哈希，保存前重新算；不一致先弹确认 |
| `zone-editor` | 只 patch `zones` / `zoneReactions` | 同上；另外启动时会先读 YAML，读不到才用内置默认分区 |
| `rules-editor` | 只 patch `rules.items` / `policy.stateRules` | 同上；没成功读取配置时**直接禁止保存**（否则会写出一份空规则） |

确认框里可以直接放弃，放弃后点「重新读取」拿到最新文件再改。哈希用的是 `crypto.subtle` 的 SHA-1，只在 `127.0.0.1` 这类安全上下文里可用；取不到哈希时按“无保护”处理，不会挡住正常保存。

`zone-editor` 以前用的是写死在 HTML 里的分区数组，跟 `pet.yaml` 无关——保存一次就会把真实分区换回那套默认值。现在改成启动即读配置，内置数组只作为读不到文件时的兜底。

## 运行

**双击 start.bat**：自动找 Python、起本地服务、打开浏览器。关掉黑色窗口即停止。

它跑的是 `tools/serve.py`，比静态服务器多这些能力：

- `POST /api/save` 写入 `config/` 下的文件
- `POST /api/patch` 合并 `zones` / `zoneReactions` / `rules.items` 并编译
- `POST /api/restore` 从 `config/.backup/` 回滚
- `GET /api/version` 版本号，供演示页轮询
- `GET /api/assets?kind=clips|images|json` 磁盘上真实存在的素材清单（编辑器下拉用）

所以三个编辑器的「保存并编译」按钮全程不用敲命令。保存成功后，已打开的演示页会自动重载。

也可以手动起服务：

```powershell
python -m http.server 8080
```

- 入口：<http://127.0.0.1:8080/home.html>
- 演示：<http://127.0.0.1:8080/index.html>（ES 模块，必须走 HTTP）

> 双击 HTML 走 `file://` 大多能用，但浏览器会拦截自动读取——用配置编辑器的「打开 YAML」，或者起服务。

## 目录

```
pet-lab/
├─ home.html              统一入口
├─ index.html             演示 + 信号面板
├─ config-editor.html     可视化配置
├─ zone-editor.html       可视化分区
├─ rules-editor.html      可视化规则
├─ docs.html              Markdown 阅读器
├─ start.bat              一键起服务
├─ assets/i18n.js         中英切换 + 帮助面板
├─ config/pet.yaml        配置源（唯一手改）
├─ config/pet.default.yaml 出厂默认（「恢复默认」读它）
├─ js/pet/                ES 模块
│  ├─ index.js            入口
│  ├─ core.js             内核：总线 / 裁决 / 装配
│  ├─ site.js             与站点对话的唯一出口（只认 window.SiteAPI）
│  ├─ adapter.js          站点层：上下文 / 规则 / 存储（不再碰 DOM）
│  ├─ content/            zh.js / en.js：全部台词与回答（只放字，不放逻辑）
│  └─ modules/            player, machine, actions, speech,
│                         renderers, rules, zones, search
├─ vendor/js-yaml.min.js  YAML 解析（编辑器与 build-config 共用）
├─ images/pet/anim/       33 段透明 WebM + poster.webp
├─ tools/                 构建、冒烟、单测、开发服务器
├─ docs/                  API 参考、交互协议草案、截图
├─ LICENSE                代码 MIT
├─ LICENSE-ASSETS.md      素材 CC BY-NC-SA 4.0
├─ CREDITS.md             作者、上游仓库、逐文件映射
└─ release/               发版用：发行版 README 模板 + 各版说明
```

## 文档

| 文件 | 内容 |
| --- | --- |
| [STATUS.md](STATUS.md) | 项目状态：模块地图、测试、发布状态 |
| [docs/API.md](docs/API.md) | 公开 API、事件、扩展方式 |
| [docs/INTERACTION.md](docs/INTERACTION.md) | 交互协议**设计稿**：能力授权、语音输入（未实现） |
| [HANDOFF.md](HANDOFF.md) | 重构前的历史与决策 |
| [KNOWN-ISSUES.md](KNOWN-ISSUES.md) | 已知问题清单（含原因与修法） |
| [docs/SITE_API_REQUIREMENTS.md](docs/SITE_API_REQUIREMENTS.md) | **给站点侧的对接需求清单**（13 条，含验收方式） |

英文版：`README.en.md`、`STATUS.en.md`、`docs/API.en.md`、`docs/INTERACTION.en.md`、`HANDOFF.en.md`、`KNOWN-ISSUES.en.md`、`docs/SITE_API_REQUIREMENTS.en.md`。

## 内容与文案（换角色 / 换语言只改这里）

代码里不写句子。所有给访客看的字都在 `js/pet/content/`：

| 文件 | 内容 |
| --- | --- |
| `content/zh.js` | 中文文案：闲聊句库、状态词、站点回答、分区反应、旁白 |
| `content/en.js` | 英文文案，键与中文一一对应，缺的键自动回落到中文 |
| `content/index.js` | 取值层：`t(key, vars)` / `pick(key)` / `list(key)` / `replies()` |

```js
PetContent.t('mood.sleeping')                // → “打盹中” / "napping"
PetContent.t('site.streak', { n: 3 })        // → “这是你连续来的第 3 天…”
PetContent.pick('chat.fallback')             // 数组里随机取一条
PetContent.setLang('en')                     // 运行时切换（已渲染的文字不追溯）
```

几条约定：

- **只放字，不放逻辑。** 什么时候说、按什么顺序判断仍在代码与 `pet.yaml` 里；文案文件只回答“说什么”。
- **问句特征词也算文案。** `site.patterns`、`search.stopwords`、`search.intent`、`adapter.keywords` 都是按语言写的正则/词表，换语言要一起换，否则英文提问只会回落到通用句库。
- **角色专属的台词优先走 `pet.yaml` 的 `persona`。** 配置里有就用配置的，`content` 里的只是兜底。
- **工具页文案（编辑器、演示页）在 `assets/i18n.js`。** 那里是中英成对的键值表，页面上用 `data-i18n="key"` 或 `PetI18n.t('中文')` 取。

语言判定顺序：`localStorage['pet-content-lang']` → `<html lang>` → 默认中文。所以博客是中文站就永远是中文，除非站点把 `lang` 改成 `en`。

## 站点对接：只认 `window.SiteAPI`

宠物不读页面 DOM、不认自己的 URL、不碰站点的内部对象，所有站点信息都走 `window.SiteAPI`
（对接契约见博客仓库的 `SITE_API_INTEGRATION_GUIDE.md`）。这一层收到 `js/pet/site.js` 里，是唯一的耦合面。

| 用途 | 调用 | 权限 |
| --- | --- | --- |
| 这是哪一页 | `currentContext()` | read |
| 检索文章/题目/知识卡 | `content().search()` | read |
| 文章标签与字数 | `content().list('document')` | read |
| 阅读进度 | `reading().get()` + `reading:position` 事件 | read-local |
| 站内跳转 | `actions().invoke('navigation.open')` | read |
| 收藏 / 笔记 / 阅读位置 | `actions().invoke('bookmark.*' / 'note.*' / 'reading.*')` | write-local |
| 宠物自己的状态 | `userState('pet.*')` | write-local |

三条硬规矩：

1. **写操作一律走 `actions().invoke`**，需要用户确认的交给 SiteAPI 自己弹窗，宠物不伪造 `confirmed`；
2. **不抢首屏**：`SiteAPI.ready()` 会让站点加载内容库（5MB 级），所以默认延迟 6s 再调（`site.readyDelayMs`），
   文章元信息再晚 2s 且只在规则真的用到时才取（`site.postMeta`）；
3. **站点没给的就不猜**：主题（`dark`）和评论数（`comments`）不在 SiteAPI 里，对应规则不会命中，
   不会再回头去爬页面。要恢复这些台词，正确做法是站点在 `currentContext()` 里补字段。

没有 SiteAPI 的页面（比如本仓库的 `index.html` 演示页）宠物照样跑：动作、对话、句库都在本地，
只是没有站点上下文与检索，提问会回一句"这一页没接上站点的检索接口"。

## 默认配置与重置

`config/pet.default.yaml` 是一份**独立保存的出厂默认**，和 `pet.yaml` 分开存放：

- 三个编辑器里的「恢复出厂默认」都读它，只把值载入界面，不立刻写盘；
- `config-editor` 的「撤销全部改动」是另一件事：回到本次读取时的状态。

命令行等价物：

```bash
node tools/build-config.js            # 编译 pet.yaml → js/pet/config.js
node tools/build-config.js --reset    # 用默认值覆盖 pet.yaml（先备份到 config/.backup/）
node tools/build-config.js --snapshot # 把当前 pet.yaml 存成新的默认值
node tools/build-config.js --check    # 只校验，不写文件
```

改过默认值之后记得 `--snapshot` 一次，否则「恢复默认」还是旧的。

## 配置

`config/pet.yaml` → `js/pet-config.json` + `js/pet/config.js`。

运行时 `PetConfig` 与内置默认值深合并，只需写想改的键。配置项分十二组：身份、投影、节奏、拖拽、点击、语言、对话、规则、检索、动作库、分区、分区反应。

改完**不用**手动编译——开发服务器会自己发现并重编（见下节）。

### 换一只宠物

这套东西不是只为鲸鱼娘写的。角色相关的东西全部在配置里，换宠物**只改 YAML**：

| 键 | 作用 | 换宠物时 |
| --- | --- | --- |
| `animDir` / `image` | 动画目录、首帧图 | 指向新素材目录 |
| `clipExt` | 动画扩展名（默认 `webm`） | 素材不是 WebM 时改 |
| `name` | 内部名 | 一般不用动 |
| `hostId` | DOM 挂载点 id（默认 `deepseek-pet`） | 同页放两只时改成不同值 |
| `size` | 立绘框 `width` / `height`，写进 CSS 变量 | 按新素材比例改 |
| `accent` | 主题色 `primary` / `primary2` / `cyan` | 按新角色配色改 |
| `persona` | 全部台词：名字、自我介绍、睡觉、投喂、问候、天数、图标、署名 | 整段重写 |
| `states` / `policy` / `zones` / `rules` | 状态、仲裁、分区、情境规则 | 按新角色重做 |

代码里没有角色专属文案了：`js/pet/index.js` 只通过 `CONFIG.persona.*` 取字符串，取不到才用中性兜底。实测把配置换成「小橘」（橘猫）+ 另一个素材目录后，挂载点、标题、占位符、主色、立绘框尺寸、素材请求路径全部跟着变，没有动一行 JS。

CSS 的根选择器是 `.dp-root` 而不是 id，所以 `hostId` 可以随便改。

**素材格式**：目前播放器只吃带 alpha 的 WebM（双 `<video>` 缓冲）。GIF / APNG / 序列帧要换掉 `js/pet/modules/player.js`，它对外的接口只有 `play / ready / warm / setMirror`。

### 睡眠片段的循环区间

`sleep.webm` 是一整段「打瞌睡 → 躺下 → 睡着 → 醒来」，整段循环会每 10 秒站起坐下一次。
在 `states.sleepy` 里加 `loop` 就能只循环"已经睡着"的那一截：

```yaml
states:
  sleepy:
    clip: sleep
    loop:
      intro: 4.65   # 0→4.65 只播一次（躺下的过程）
      end: 6.85     # 之后只在 4.65→6.85 之间循环
```

去掉 `loop` 就退回整段循环。边界值可以用 ffmpeg 按帧测出来：

```powershell
ffmpeg -i images/pet/anim/sleep.webm -c:v libvpx-vp9 -vsync 0 -pix_fmt rgba frames/f_%03d.png
```

（必须带 `-c:v libvpx-vp9`，否则 alpha 会丢；帧图逐帧比对就能找到姿态最接近的一对起止点。）


**站点侧**：`js/pet/site.js` 只认 `window.SiteAPI`，`adapter.js` 与 `modules/search.js` 都骑在它上面；换博客框架时只要对方提供 SiteAPI，这三个文件都不用动。

### 同页放两只

模块地址带 `?pet=<名字>` 时，它会去 `window.PetProfiles` 里取同名覆盖项。不同 URL 的模块会被浏览器当成两个独立实例分别求值，各自一份闭包状态、内核和存储：

```html
<script>
window.PetProfiles = {
  cat: {
    hostId: 'pet-cat',          // 不同挂载点
    storageKey: 'pet-cat-v1',   // 不同存档（localStorage 里是 dp:pet-cat-v1）
    offset: { x: 168, y: 8 },   // 错开位置，别叠在一起
    size: { width: 150, height: 133 },
    accent: { primary: '#f08a3c', primary2: '#e2603a', cyan: '#ffd08a' },
    persona: { name: '小橘', about: '……', feed: ['……'] },
    states: { idle: { clip: 'sad', pool: ['sad'] }, sleepy: { clip: 'doze', pool: ['doze'] }, busy: { clip: 'think', pool: ['think'] } }
  }
};
</script>
<script type="module" src="/js/pet/index.js"></script>
<script type="module" src="/js/pet/index.js?pet=cat"></script>
```

`pets.html` 是一个可运行的例子（大肥鱼 + 小橘）。要点：

- `hostId`、`storageKey`、`offset` 三个必须各不相同，否则会抢同一个挂载点或叠在同一位置
- `window.PetDebug[hostId]` 分别是两个实例的调试入口
- 代价：模块体会求值两次（子模块如 `rules.js`、`adapter.js` 仍共用一份），内存里多一份闭包状态

### 界面时序

左侧那排动作按钮（投喂 / 聊天 / 隐藏）在鼠标离开后有宽限期，不会一移开就消失：

```yaml
ui:
  actionHideDelayMs: 320   # 离开后多久收起
  actionFadeMs: 140        # 淡入淡出时长
```

这段宽限期是为了修一个实际手感问题：按钮在角色左侧、和角色之间有 8px 视觉间距，
鼠标横穿时 `:hover` 会瞬间断开，按钮在指针到达前就消失了。现在间距用 `padding` 补齐（指针一直在
元素范围内），再叠加 320ms 宽限，正常速度移动都能点中。数值按手感调即可。

## 同步到博客

```powershell
node tools/sync-blog.js --check    # 只看差异
node tools/sync-blog.js            # 复制 + 校验
node tools/sync-blog.js --build    # 复制 + 校验 + hexo clean + hexo generate
```

`--build` 默认**先 clean 再 generate**：`public/` 里残留上一次的产物会让版本戳覆盖不全
（实测不 clean 时 263/318，clean 后 318/318）。确实要增量构建时加 `--no-clean`。
生成后脚本会自己数一遍 `public/` 里的 HTML 与带 `?v=` 的数量，对不上就报错退出。

只同步三样，博客侧独有的东西（`custom-global.js`、`scripts/pet-*.js`、主题配置）不碰：

| 源（pet-lab） | 目标（Blogs） |
| --- | --- |
| `js/pet/**` | `source/js/pet/**` |
| `css/deepseek-pet.css` | `source/css/deepseek-pet.css` |
| `images/pet/anim/**` | `source/images/pet/anim/**` |

素材目录是镜像式的：上游删掉的文件在博客里也会删掉；`source/images/pet/whale-girl.png`（博客自己的图）不在范围内。
文本按 LF 复制，复制完会重新比对一遍，不一致就报错。

版本戳由博客自己的 `scripts/pet-version.js` 在构建时算：改完源码重新 `hexo generate` 就会换新的 `?v=`
（`pet version: <hash> | html stamped: <n>`）。

两边目录不在一起时用环境变量：`$env:PET_BLOG_DIR = 'D:\path\to\Blogs'`。
## 测试

```powershell
node tools/run-tests.js          # 单元：内核 / 规则 / 分区 / 级别 / 规则数据
node tools/run-tests.js --all    # 加上端到端冒烟 + 中英一致性
```

冒烟覆盖：挂载、模块装配、气泡、分区点击、动作意图、站内检索。
`tools/i18n-check.js` 检查 7 个页面的文本与标题是否中英一致。
`python tools/check-copy.py` 检查有没有人在 `js/pet/` 里重新写死中文文案（`content/` 除外）。

点击类断言用 `Input.dispatchMouseEvent` 派发真实鼠标事件——合成 `PointerEvent` 测不出拖拽/点击的判定逻辑。

## 架构

```
站点（数据 + 交互） ──信号──▶ 规则 ──意图──▶ 宠物模块
```

三条硬约束：

1. 模块不能直接改宠物状态（发 `intent.action` / `speech.act`）
2. 单一身体所有权（冲突发 `intent.rejected`）
3. HFSM 是动作模块内部实现，对外只暴露意图

详细说明见 [STATUS.md](STATUS.md)；重构前的问题史见 [HANDOFF.md](HANDOFF.md)。

## 缓存与生效

**pet-lab（开发）**：配置改动**不需要**手动跑 `build-config.js`。

| 改法 | 是否自动编译 | 演示页是否自动重载 |
| --- | --- | --- |
| 编辑器「保存并编译」 | 是 | 是（`localStorage` 广播，立刻） |
| 直接改 `config/pet.yaml` | 是（看门狗 1 秒内发现，改动前自动留快照） | 是（轮询 `/api/version`，约 2.5 秒内） |
| 改 `css/` 或 `js/pet/` | 不需要 | 是（同一套监视，不触发编译） |
| 没有服务器（`file://`） | 否，需手动 | 否 |

`tools/serve.py` 还对所有响应发 `Cache-Control: no-store`，普通刷新就能拿到新配置。

**博客（发布）**：`scripts/pet-version.js` 在构建结束时给宠物模块加指纹，
链路是 `HTML → custom-global.js?v=H → index.js?v=H → config.js?v=H`。
哈希取自 `source/js/pet` 的源文件，构建多次也稳定，只有配置或模块真的变了才会变。
指纹文件：`public/js/pet/version.txt`。

## 版本控制

目录根有 `.gitignore`，忽略：`config/.backup/`（本地快照，手改触发的那份带 `-edit` 后缀）、Chrome 临时 profile、调试日志与截图、`build/`（发版产物）。
`config/pet.yaml` 本身要提交——它是配置源。

## 发版

```powershell
node tools/release.js 1.0.2            # 本地组装 + 校验 + 打包，打印计划
node tools/release.js 1.0.2 --push     # 推 release 分支、打 tag、建 GitHub Release
```

产物在 `build/`（已忽略）：`pet-lab-1.0.2/` 发行目录、`pet-lab-v1.0.2.zip`、`.sha256`。

脚本按顺序做四件事，每步都回读产物而不是"假设成功"：

1. **组装**：白名单打包（`SHIP` 列表 + `images/pet/**` + `release/README.md`），开发内容根本不在清单里
2. **校验**：
   - 目录里出现 `tools/manual`、`*.html`、`HANDOFF`、`screenshots` 等一律报错
   - `js/` `css/` `config/` `vendor/` `tools/` 下每个文件与仓库逐字节比对（防"复制没执行"）
   - 每个 `.js` 过 `node --check`
   - 发行版 README 里的版本号必须是本次版本
   - 用发行包自带的 `tools/build-config.js` 重编一遍 `pet.yaml`，结果要和仓库里的 `config.js` 一致
3. **打包**：自己写的确定性 ZIP（固定时间戳与顺序，文本统一按 LF 落盘），同样的输入永远同一个 sha256，不受 Windows 换行影响
4. **发布**（`--push`）：镜像同步到 `../pet-dist`（`release` 分支的独立仓库）→ 提交 → 推分支 → 打 tag → `gh release create` → **回读远端附件的 sha256 与本地比对**

发版说明写在 `release/notes/<版本>.md`；发行版 README 是 `release/README.md`，用 `{{VERSION}}` 占位。

## 已知问题

完整清单（含原因与修法）见 [KNOWN-ISSUES.md](KNOWN-ISSUES.md)。

## 授权

| 范围 | 协议 | 文件 |
| --- | --- | --- |
| 代码（`js/` `css/` 文档，MIT 不含素材） | MIT | [LICENSE](LICENSE) |
| 素材（`images/`） | CC BY-NC-SA 4.0 | [LICENSE-ASSETS.md](LICENSE-ASSETS.md) |
| 署名与素材映射 | — | [CREDITS.md](CREDITS.md) |

**素材非商用**：不得接入广告、赞助或付费内容，不得售卖周边；公开使用需署名并保留上游仓库链接。
商用请分别取得原作者授权。
