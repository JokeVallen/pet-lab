# 宠物实验室（pet-lab）

鲸鱼娘宠物「大肥鱼」的独立工具集。**不依赖 Hexo / Butterfly**，只靠一个静态服务器就能跑；接进任何站点只改一个适配层。

## 页面

双击 `home.html` 即可，也可以单独打开：

| 页面 | 用途 |
| --- | --- |
| `home.html` | 统一入口 |
| `index.html` | 宠物演示（需本地服务器，ES 模块） |
| `config-editor.html` | 她**是什么**：外观 / 节奏 / 语言 / 动作库 / 状态（clip、池、权重） |
| `zone-editor.html` | 身体分区：二维框、鼠标反应、外观与底图 |
| `rules-editor.html` | 她**何时做什么**：状态规则（条件 → 状态）+ 情境规则（条件 → 台词 / 动作） |
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
├─ js/pet/                ES 模块
│  ├─ index.js            入口
│  ├─ core.js             内核：总线 / 裁决 / 装配
│  ├─ adapter.js          站点层：DOM / URL / 存储 / 规则
│  └─ modules/            player, machine, actions, speech,
│                         renderers, rules, zones, search
├─ vendor/js-yaml.min.js  YAML 解析（编辑器用）
├─ images/pet/anim/       32 段透明 WebM
├─ tools/                 构建、冒烟、单测、开发服务器
└─ docs/                  API 参考、交互协议草案、截图
```

## 文档

| 文件 | 内容 |
| --- | --- |
| [STATUS.md](STATUS.md) | 项目状态：模块地图、测试、发布状态 |
| [docs/API.md](docs/API.md) | 公开 API、事件、扩展方式 |
| [docs/INTERACTION.md](docs/INTERACTION.md) | 交互协议**设计稿**：能力授权、语音输入（未实现） |
| [HANDOFF.md](HANDOFF.md) | 重构前的历史与决策 |
| [KNOWN-ISSUES.md](KNOWN-ISSUES.md) | 已知问题清单（含原因与修法） |

英文版：`README.en.md`、`STATUS.en.md`、`docs/API.en.md`、`docs/INTERACTION.en.md`、`HANDOFF.en.md`、`KNOWN-ISSUES.en.md`。

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

**站点侧**：`js/pet/adapter.js` 与 `modules/search.js` 是给 Hexo + Butterfly 写的，换博客框架时只重写这两个文件。

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

## 测试

```powershell
node tools/run-tests.js          # 单元：内核 / 规则 / 分区 / 级别 / 规则数据
node tools/run-tests.js --all    # 加上端到端冒烟 + 中英一致性
```

冒烟覆盖：挂载、模块装配、气泡、分区点击、动作意图、站内检索。
`tools/i18n-check.js` 检查 7 个页面的文本与标题是否中英一致。

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

目录根有 `.gitignore`，忽略：`config/.backup/`（本地快照，手改触发的那份带 `-edit` 后缀）、Chrome 临时 profile、调试日志与截图。
`config/pet.yaml` 本身要提交——它是配置源。

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
