# 项目状态

> 更新时间：2026-10-31

---

## 一、这是什么

把博客宠物「大肥鱼」从单体脚本重构成**可移植、可插拔**的独立系统。

```
站点（数据 + 交互） ──信号──▶ 规则 ──意图──▶ 宠物模块
```

- 宠物 = 动作（必需）+ 语言（可选）+ 其他可选模块
- 站点只提供信号，宠物不认识 Hexo / Butterfly
- 换站点：对方实现 `window.SiteAPI` 即可，`js/pet/site.js` 是唯一耦合面

## 二、模块地图

| 文件 | 大小 | 职责 |
| --- | --- | --- |
| `js/core.js` | 7.6 KB | 内核：事件总线、优先级裁决、增量装配、环形日志 |
| `js/pet/site.js` | 4.9 KB | 与站点对话的唯一出口（只认 `window.SiteAPI`） |
| `js/pet/adapter.js` | 9.8 KB | 站点层：上下文缓存 / 规则表 / 存储（不碰 DOM） |
| `js/modules/player.js` | 7.9 KB | 双缓冲播放器（依赖注入 clips/config/pick/randInt） |
| `js/modules/machine.js` | 3.1 KB | 分层状态机（点号层级、池子继承、onEnter） |
| `js/modules/actions.js` | 2.5 KB | 动作端口：intent.action / state / hold / release |
| `js/modules/speech.js` | 3.5 KB | 语言通道：去重、优先级队列、投递 |
| `js/modules/renderers.js` | 2.5 KB | 气泡 / 对话框渲染 + 站内链接化 |
| `js/modules/rules.js` | 2.3 KB | 声明式规则引擎（顺序即优先级、规则级冷却、容错） |
| `js/modules/zones.js` | 3.0 KB | 点击分区几何 + 映射解析（子级优先、父级回落） |
| `js/pet/modules/search.js` | 2.6 KB | 把提问转成 `SiteAPI` 检索，再把结果说成人话 |
| `js/modules/config.js` | 生成物 | 由 `config/pet.yaml` 编译而来，勿手改 |
| `js/deepseek-pet.js` | ~54 KB | 本体：交互入口、对话、待机调度、UI 构建 |

依赖方向严格单向：`adapter → 信号 → 规则 → 意图 → 模块`。

## 三、三条硬约束

1. **模块不能直接改宠物状态**：动身体发 `intent.action`，说话发 `speech.act`
2. **单一身体所有权**：同一时刻只能有一个动作生效，冲突方收到 `intent.rejected`
3. **HFSM 是动作模块内部实现**，对外只暴露意图

中断级别：`ambient(1) < scheduled(2) < direct(3) < hold(4)`。

## 四、配置系统

**源文件**：`config/pet.yaml`（唯一手改的地方）

```powershell
# 可视化编辑（必须走本地服务器，双击会被浏览器拦）
python -m http.server 8080
# → http://127.0.0.1:8080/config-editor.html

node tools/build-config.js   # YAML → js/pet-config.json + js/modules/config.js
```

- 解析用 **js-yaml 4.1.1**（`vendor/js-yaml.min.js`，从博客 `node_modules` 复制）
- 运行时：`PetConfig` 与内置默认值**深合并**，只写想改的键
- 编辑器：中文分组 + 说明文案 + 滑杆/开关/色块/芯片/分类表格

可配置项分组：身份、外观（含投影偏移）、节奏、交互、语言、情境规则、站内检索、动作库、
**点击分区（zones）**、**分区反应（zoneReactions）**。

规则与分区反应都是数据：`when` 用 14 个条件键描述，台词支持数组与 `{tag}` `{streak}` 模板。

## 五、点击分区

分区是几何，映射是语义，两张表独立：

```js
ZONES     // 归一化坐标，子分区优先命中
ZONE_MAP  // 分区 → { act, say, weight }
```

没写映射的分区自动回落父级（`head.cheek → head`），全都没有就返回 `null` 交给默认行为。

调试：`?pet-zone=1` 会在角色上叠分区带，鼠标移动时左下角显示当前分区 id。

## 六、可视化工具

`index.html` 是统一入口，三个编辑器都能双击打开：

| 页面 | 作用 |
| --- | --- |
| `config-editor.html` | 外观 / 节奏 / 语言 / 动作池，可直接打开 YAML 文件 |
| `zone-editor.html` | 拖拽画分区，编辑每区的动作与台词，导出两段 YAML |
| `rules-editor.html` | 表格化编辑 12 条规则（撤销 / 重做），导出 `rules.items` |

命令行（`node tools/build-config.js`）留给自动化与 AI 调度。

## 七、测试

```powershell
node tools/run-tests.js          # 单元：内核 / 规则 / 分区
node tools/run-tests.js --all    # 加上端到端冒烟（无头 Chrome）
node tools/smoke.js              # 只跑冒烟
```

| 测试 | 覆盖 | 现状 |
| --- | --- | --- |
| `tests/kernel.test.js` | 总线、优先级裁决、hold/release、装配 | 15 项通过 |
| `tests/rules.test.js` | 顺序、冷却、函数式字段、matchTag | 6 项通过 |
| `tests/zones.test.js` | 子级优先、回落、x 范围、权重抽取 | 10 项通过 |
| `tools/smoke.js` | 挂载、装配、气泡、点击、意图、检索 | 12 项通过 |
| `tools/i18n-check.js` | 中英文本、标题、占位符 | 10 项通过 |

冒烟测试用 `Input.dispatchMouseEvent` 派发**真实鼠标事件**——合成 `PointerEvent` 测不出拖拽/点击判定，曾因此漏掉 bug。

## 八、已知问题

完整清单见 [KNOWN-ISSUES.md](KNOWN-ISSUES.md)。

## 九、下一步

1. **拆交互入口**：`doPet` / `doFeed` / `sendChat` 仍在本体里，属于"站点交互 → 意图"的翻译，最终应进 adapter
2. **台词外置**：`REPLIES`、`ZONE_MAP` 的文本可抽成短语包，支持多主题/多语言
3. **状态机阈值进配置**：`resolve()` 里的"22 点 / 6 点 / 滚动 12%~92%"是性格参数，应该可调
4. **第三块 video**：根治拖拽首次空白
5. **扩展模块**：听歌、对话式网页交互（都只需发意图，不碰 DOM）

## 十、发布状态

- 工具集：已验证（单元 + 端到端 + 中英一致性）
- 站点接入：同步 `adapter` / `config` / `core` / `index` / `rules` 五个模块即可；构建期自动加版本指纹（`pet-version.js`），访客不会跑到旧配置
- 素材授权：代码 MIT，动画素材**非商用**，需署名（见 `PET_CREDITS.md`）

- 交互协议（能力授权 / 语音输入）只有设计稿：[docs/INTERACTION.md](docs/INTERACTION.md)，尚未实现。

- 状态词汇表（`states`）与站点策略（`policy`）分离：宠物只认状态 id，何时进入由 `PetAdapter.pickState` 按配置判断；节假日日历也从代码移入配置。

- 测试面板 `tests.html`：8 个套件（6 单元 + 冒烟 + 中英）可单跑，走 `POST /api/test`，套件名白名单校验。
- 页面分工：`index.html` 是首页（入口），`demo.html` 是宠物演示；发行包在打包时**删除**开发侧内容（测试面板、项目状态、开发沿革、已知问题、API/交互文档），不是运行期隐藏。

- 文案独立成页：`copy-editor.html` 只管 `persona.*` 的台词（跟随右上角语言按钮切中英、逐条实时预览），配置页不再承载文案；变量插入统一收进一个默认折叠的面板，不再每条重复绘制。

- 占位符全局可用：取值下沉到 `speech` 出口，规则台词、分区反应、检索结果一并生效。变量 23 个（角色 / 来访 / 时间 / 页面），另有语境变量 `{name}`；支持 `{x?a:b}`、`{x??a}`、`{!x?a:b}` 条件写法，未知变量原样保留。清单与说明见 `vars.html`，由 `tools/manual/check-vars-doc.js` 与运行时对账。

- 表达式实现只有一份：`js/pet/content/expr.js`，运行时与编辑器预览共用，避免两边行为漂移。
- 对接文档：`docs/BLOG_INTEGRATION.md`（中英各一份）写给维护博客的人或 AI——只同步发行包、不碰 `js/pet/`、验证命令与排查表在文档里；`docs.html` 的「接入博客」可读。
