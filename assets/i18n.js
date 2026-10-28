/*!
 * i18n.js —— 中英双语 + 使用说明
 *
 * 用法：页面底部引入本文件。
 *   PetI18n.t('中文')            → 当前语言下的文本（缺英文时回落中文）
 *   PetI18n.lang                  'zh' | 'en'
 *   PetI18n.onChange(fn)         语言切换后回调（用于重渲染动态内容）
 *
 * 静态文案通过 data-i18n="key" 标记，key 见 STR 表。
 */
(function (global) {
    'use strict';

    var STR = {
        'home.title': ['宠物实验室', 'Pet Lab'],
        'home.sub': ['大肥鱼的本体、配置与调试工具。所有页面都可以单独打开。',
                     'The body, settings and debug tools for the whale-girl pet. Every page opens on its own.'],
        'home.play': ['宠物演示', 'Live demo'],
        'home.play.desc': ['空白页面上跑一只宠物，左下角有信号面板，可以手动触发各种意图。',
                           'A pet on a blank page, with a signal panel in the corner to fire intents by hand.'],
        'home.config': ['配置编辑器', 'Settings editor'],
        'home.config.desc': ['调外观、节奏、语言、规则冷却、动作池。改完导出 pet.yaml。',
                             'Tune looks, timing, speech, cooldowns and animation pools. Export pet.yaml when done.'],
        'home.zone': ['分区编辑器', 'Zone editor'],
        'home.zone.desc': ['在角色图上拖出点击区域，子分区自动覆盖父分区，导出 YAML。',
                           'Drag clickable regions onto the character; child zones override parents. Export YAML.'],
        'home.rules': ['规则编辑器', 'Rules editor'],
        'home.rules.desc': ['每条情境规则的条件、台词、动作和冷却，可视化增删改。',
                            'Edit each rule condition, line, action and cooldown as a form.'],
        'home.issues': ['已知问题', 'Known issues'],
        'home.issues.desc': ['待修的缺陷、限制与历史上的坑。',
                             'Open defects, limits, and lessons from past bugs.'],
        'demo.title': ['宠物演示 · 大肥鱼', 'Pet demo · Da Fei Yu'],
        'demo.h1': ['宠物演示', 'Live demo'],
        'demo.sub': ['离线环境 · 只加载宠物本体，不含博客任何依赖',
                     'Offline sandbox: only the pet loads, no blog dependencies'],
        'demo.p1': ['这一页只做一件事：确认宠物能脱离 Hexo / Butterfly 独立运行。',
                    'This page does one thing: prove the pet runs without Hexo or Butterfly.'],
        'demo.stage': ['当前阶段', 'Current stage'],
        'demo.p2': ['代码是从博客里原样拷贝出来的第一版，内部仍然是单体结构（播放器、状态机、上下文规则、对话都在这一个文件里），并且还在直接读 location、document、localStorage。',
                    'The code is the first copy lifted from the blog. It is still monolithic — player, state machine, context rules and dialogue share one file — and still reads location, document and localStorage directly.'],
        'demo.p3': ['接下来的重构目标：', 'Refactor targets:'],
        'demo.li1': ['内核（装配、事件总线、调度、持久化）', 'Kernel: assembly, event bus, scheduling, persistence'],
        'demo.li2': ['动作模块（HFSM 状态机 + 播放器）', 'Action module: HFSM + player'],
        'demo.li3': ['语言模块（speech act → 气泡 / 对话框渲染器）', 'Speech module: speech act → bubble / dialog renderers'],
        'demo.li4': ['适配层（把站点信号规范化，本站的 adapter 只在这里）', 'Adapter layer: normalises site signals; site-specific code lives only here'],
        'demo.how': ['怎么用这一页', 'How to use this page'],
        'demo.p4': ['左下角是测试面板：动作、状态与睡眠、互动、说话通道、提问、语言与配置读数，都只是发信号，不直接改宠物内部状态。',
                    'The bottom-left panel is a test bench: actions, state and sleep, interactions, speech channels, asking a question, language and a config readout. Every button emits a signal instead of poking internals.'],
        'demo.p5': ['要验证滚动相关行为，直接滚动本页即可——页面下半部分有足够的空白。',
                    'To check scroll behaviour just scroll this page — the lower half is deliberately empty.'],
        'demo.assets': ['素材', 'Assets'],
        'demo.p6': ['32 段动画，4.55 MB，全部为带 alpha 的 VP9 WebM，路径与博客一致（/images/pet/anim/），所以宠物代码不需要改动路径。',
                    '32 clips, 4.55 MB, all VP9 WebM with alpha, at the same paths as the blog (/images/pet/anim/), so no path changes are needed.'],
        'demo.bottom': ['页面底部 —— 滚动到这里应触发「读到底了」。',
                        'Bottom of page — scrolling here should fire "reached the end".'],
        'demo.lab': ['测试面板', 'Test panel'],
        'demo.lab.toggle': ['收起', 'Collapse'],
        'demo.g.act': ['动作（直接 cue）', 'Actions (cue directly)'],
        'demo.g.state': ['状态与睡眠', 'State and sleep'],
        'demo.state.idle': ['待机', 'Idle'],
        'demo.state.busy': ['忙碌', 'Busy'],
        'demo.state.sleepy': ['困倦', 'Sleepy'],
        'demo.sleep': ['强制入睡', 'Force sleep'],
        'demo.wake': ['叫醒', 'Wake up'],
        'demo.g.interact': ['互动', 'Interactions'],
        'demo.feed': ['喂食', 'Feed'],
        'demo.poke.head': ['戳脑袋', 'Poke head'],
        'demo.poke.tail': ['戳尾巴', 'Poke tail'],
        'demo.particles': ['粒子 ×1', 'One particle'],
        'demo.g.speech': ['说话', 'Speech'],
        'demo.speech.ambient': ['闲话', 'Ambient'],
        'demo.speech.context': ['情境', 'Context'],
        'demo.speech.reply': ['回答', 'Reply'],
        'demo.speech.dialog': ['进对话框', 'To dialog'],
        'demo.g.ask': ['问一句（走检索 / 句库）', 'Ask (search + lines)'],
        'demo.ask': ['提问', 'Ask'],
        'demo.ask.ph': ['有没有讲算法的？', 'Do you have anything about algorithms?'],
        'demo.g.lang': ['语言与配置', 'Language and config'],
        'demo.showConfig': ['看配置', 'Show config'],
        'demo.reload': ['刷新（重置会话）', 'Reload (reset session)'],
        'demo.g.site': ['模拟站点信号', 'Simulate site signals'],
        'demo.sim1': ['导航到首页', 'Go to home'],
        'demo.sim2': ['进入一篇文章', 'Open an article'],
        'demo.sim3': ['滚动到底（信号）', 'Scroll to bottom (signal)'],
        'demo.sim4': ['模拟首次访问', 'Simulate first visit'],
        'demo.sim5': ['滚回顶部', 'Scroll back to top'],
        'demo.sim6': ['喂食（驱动 eat）', 'Feed (drives eat)'],
        'demo.sim7': ['戳脑袋（click-shy）', 'Poke the head (click-shy)'],
        'demo.sim8': ['刷新（重置会话）', 'Reload (reset session)'],
        'home.api': ['API 文档', 'API reference'],
        'home.api.desc': ['内核、模块、端口、事件的接口说明，写扩展前先看这份。',
                          'Interfaces for the kernel, modules, ports and events. Read before extending.'],
        'home.status': ['项目状态', 'Project status'],
        'home.status.desc': ['当前架构、模块地图、已知问题与下一步计划。',
                             'Current architecture, module map, known issues and next steps.'],
        'home.readme': ['使用说明', 'Readme'],
        'home.readme.desc': ['怎么运行、目录结构、配置流程、测试命令。',
                             'How to run, folder layout, config workflow and test commands.'],
        'home.footer': ['代码 MIT，动画素材非商用，署名见博客仓库 PET_CREDITS.md。',
                        'Code MIT; animations are non-commercial. See PET_CREDITS.md for attribution.'],
        'home.docs': ['文档', 'Docs'],
        'home.docs.desc': ['接口说明、项目状态与历史。', 'API reference, project status and history.'],
        'home.note': ['改完配置后', 'After editing'],
        'home.note2': ['，服务器会自动编译并刷新演示页；想手动编译就执行', ', the server rebuilds and reloads the demo; to build by hand run '],
        'home.note3': ['三个页面都能直接双击打开；如果浏览器拦截了本地文件，再用本地服务器：',
                       'All pages open by double-click. If the browser blocks local files, start a server:'],

        'home.serveTitle': ['想看宠物演示', 'To see the live pet'],
        'home.serveDesc': ['：双击 pet-lab 目录里的', ': double-click'],
        'home.serveDesc2': ['，会自动启动本地服务器并打开浏览器。关掉那个黑色窗口就停止。',
                            ' in the pet-lab folder. It starts a local server and opens the browser. Close that window to stop.'],

        'msg.saving': ['正在保存…', 'Saving…'],
        'msg.saved': ['已保存并编译完成', 'Saved and rebuilt'],
        'msg.failed': ['失败：', 'Failed: '],
        'msg.loaded': ['已读取', 'Loaded'],
        'msg.needServer': ['需要本地服务器：双击 start.bat 后打开本页',
                           'Needs the local server: run start.bat and open this page'],
        'zone.status': ['拖动方块移动分区，拖右下角缩放；右侧可改数值与反应',
                        'Drag a box to move, drag the corner to resize; edit values and reactions on the right'],
        'cfg.tip': ['右侧是实时导出结果，点「保存并编译」即可生效。',
                    'The right panel is the live YAML export. Click "Save & build" to apply.'],

        'cfg.title': ['宠物配置', 'Pet settings'],
        'cfg.open': ['打开 YAML', 'Open YAML'],
        'cfg.reload': ['重新读取', 'Reload'],
        'cfg.reset': ['恢复默认', 'Reset'],
        'cfg.copy': ['复制 YAML', 'Copy YAML'],
        'cfg.download': ['下载 pet.yaml', 'Download pet.yaml'],
        'cfg.history': ['历史版本', 'History'],
        'cfg.save': ['保存并编译', 'Save & build'],

        'cfg.loading': ['正在读取…', 'Loading…'],
        'cfg.loaded': ['已读取 config/pet.yaml', 'Loaded config/pet.yaml'],
        'cfg.failed': ['读不到配置文件，点「打开 YAML」选择文件，或粘贴到下方',
                       'Cannot read config. Click "Open YAML" to pick the file, or paste below.'],
        'cfg.needfile': ['浏览器不让网页自动读取本地文件。点上方「打开 YAML」选择 config/pet.yaml，或把内容粘到下面。',
                         'Browsers block automatic local reads. Click "Open YAML" above to choose config/pet.yaml, or paste below.'],
        'cfg.exportTip': ['改完下载覆盖 config/pet.yaml，然后运行 node tools/build-config.js。',
                          'Download and overwrite config/pet.yaml, then run node tools/build-config.js.'],
        'cfg.help': ['使用说明', 'How to use'],
        'cfg.help.body': [
            '1. 点「打开 YAML」选择 config/pet.yaml（起了服务器会自动读取）。<br>' +
            '2. 左边改值，右边实时显示 YAML。<br>' +
            '3. 点「保存并编译」直接写回并生效——不用再敲命令。<br>' +
            '4. 没有服务器时，用「下载 pet.yaml」覆盖原文件，再运行 <code>node tools/build-config.js</code>。<br>' +
            '提示：滑杆调外观，芯片输入动画名（回车添加），动作分类表格可增删行。<br>' +
            '<b>改动什么时候生效</b>：点「保存并编译」后写回 YAML 并重新生成 <code>js/pet/config.js</code>；' +
            '演示页开着的话会自动重载（每 2.5 秒查一次版本号）。所以<strong>所有字段都是保存即生效</strong>，' +
            '没反应通常是字段没接进运行时代码，而不是缓存。<br>' +
            '<b>两个"恢复"不一样</b>：「撤销全部改动」回到本次读取时的状态；' +
            '「恢复出厂默认」读 <code>config/pet.default.yaml</code>，那是一份独立保存的默认配置，改了也不会被日常编辑带走。<br>' +
            '<b>保存前会看磁盘</b>：如果这个页面打开之后文件被别的标签页或手工改过，会先弹确认，' +
            '避免用旧内容整份覆盖。取消后点「重新读取」拿到最新版本再改。<br>' +
            '<b>站内数据从哪来</b>：宠物不读页面 DOM，只通过 <code>window.SiteAPI</code> 问站点' +
            '（上下文、检索、阅读位置、收藏与笔记）。站点没提供的能力（比如主题、评论数）宠物就当不知道，' +
            '相关规则不会命中——这不是坏了，是两边约定的边界。<br>' +
            '<b>命令行等价物</b>：<code>node tools/build-config.js</code> 编译；' +
            '<code>--reset</code> 用默认值覆盖并备份旧文件；<code>--snapshot</code> 把当前配置存成新的默认值。',
            '1. Click "Open YAML" and pick config/pet.yaml (auto-loads when served).<br>' +
            '2. Edit on the left; the YAML preview updates live on the right.<br>' +
            '3. Click "Save & build" to write it back and apply — no commands needed.<br>' +
            '4. Without a server, use "Download pet.yaml" then run <code>node tools/build-config.js</code>.<br>' +
            '<b>Where site data comes from</b>: the pet never reads the page DOM. It asks ' +
            '<code>window.SiteAPI</code> (context, search, reading position, bookmarks, notes). ' +
            'Anything the site does not expose (theme, comment count) is simply unknown, so those rules never fire — ' +
            'that is the agreed boundary, not a bug.<br>' +
            'Tip: sliders are for looks, chips take animation names (Enter to add), category rows are editable.<br>' +
            '<b>When changes apply</b>: "Save & build" writes the YAML back and regenerates ' +
            '<code>js/pet/config.js</code>; an open demo tab reloads itself (it polls the version every 2.5s). ' +
            'So <strong>every field applies on save</strong> — if nothing happens, the field is probably not wired ' +
            'into the runtime, not cached.<br>' +
            '<b>Two different resets</b>: "Revert all edits" goes back to what was loaded; ' +
            '"Load factory defaults" reads <code>config/pet.default.yaml</code>, a separate copy of the shipped ' +
            'defaults that ordinary editing never touches.<br>' +
            '<b>Saving checks the disk</b>: if the file changed after this tab was opened (another tab, or a manual ' +
            'edit), you get a confirmation first so stale content cannot overwrite it. Cancel, hit "Reload", edit again.<br>' +
            '<b>Command-line equivalents</b>: <code>node tools/build-config.js</code> compiles; ' +
            '<code>--reset</code> copies the defaults over (old file is backed up); <code>--snapshot</code> stores the ' +
            'current config as the new defaults.'
        ],

        'zone.title': ['分区编辑器', 'Zone editor'],
        'zone.add': ['＋ 子分区', '+ Child zone'],
        'zone.export': ['导出 YAML', 'Export YAML'],
        'zone.import': ['导入 YAML', 'Import YAML'],
        'zone.del': ['删除这个分区', 'Delete this zone'],
        'zone.hint': ['双击分区内部可建子分区；拖空白处（或按 Shift）框选新建；Shift 点选可多选，Del 删除。', 'Double-click inside a zone to add a child; drag on empty space (or hold Shift) to draw a new one; Shift-click to multi-select, Del to delete.'],
        'zone.exportTip': ['复制到 config/pet.yaml（zones 与 zoneReactions 两段），然后运行 node tools/build-config.js。',
                           'Paste into config/pet.yaml (both zones and zoneReactions), then run node tools/build-config.js.'],
        'zone.save': ['保存并编译', 'Save & build'],
        'rules.save': ['保存并编译', 'Save & build'],
        '页面类型': ['页面类型', 'Page type'],
        '细分类型': ['细分类型', 'Sub type'],
        '标签包含': ['标签包含', 'Has tag'],
        '字数 >': ['字数 >', 'Words >'],
        '字数 <': ['字数 <', 'Words <'],
        '评论数 =': ['评论数 =', 'Comments ='],
        '评论数 ≥': ['评论数 ≥', 'Comments ≥'],
        '滚动 >': ['滚动 >', 'Scroll >'],
        '滚动 ≥': ['滚动 ≥', 'Scroll ≥'],
        '滚动 <': ['滚动 <', 'Scroll <'],
        '滚动 ≤': ['滚动 ≤', 'Scroll ≤'],
        '上次滚动 >': ['上次滚动 >', 'Last scroll >'],
        '暗色主题': ['暗色主题', 'Dark theme'],
        '小时 ≥': ['小时 ≥', 'Hour ≥'],
        '小时 <': ['小时 <', 'Hour <'],
        '连续天数 ≥': ['连续天数 ≥', 'Streak ≥'],
        '（旧）': ['（旧）', ' (legacy)'],
        'cfg.revert': ['撤销全部改动', 'Revert all edits'],
        'cfg.factory': ['恢复出厂默认', 'Load factory defaults'],
        'zone.factory': ['恢复出厂默认', 'Load factory defaults'],
        'rules.factory': ['恢复出厂默认', 'Load factory defaults'],
        'reset.factoryConfirm': ['用 config/pet.default.yaml 里的出厂默认值替换当前内容？', 'Replace the current values with the factory defaults in config/pet.default.yaml?'],
        'reset.factoryHint': ['（只是载入到编辑器，点「保存并编译」才会写盘）', '(This only loads them into the editor; nothing is written until you save.)'],
        'reset.loadedCfg': ['已载入出厂默认值，点「保存并编译」写回', 'Factory defaults loaded — click Save & build to write them'],
        'reset.loadedZone': ['已载入出厂默认分区，点「保存并编译」写回', 'Factory zones loaded — click Save & build to write them'],
        'reset.loadedRules': ['已载入出厂默认规则，点「保存并编译」写回', 'Factory rules loaded — click Save & build to write them'],
        'reset.noDefault': ['读不到 config/pet.default.yaml：', 'Cannot read config/pet.default.yaml: '],
        'rules.sec.state': ['状态规则（条件 → 状态）', 'State rules (condition → state)'],
        'rules.sec.state.desc': [
            '按顺序判断，第一条命中就决定她处于什么状态；都不命中时按状态自身的权重随机。',
            'Evaluated top to bottom; the first match decides the state. If nothing matches, states are picked by their weights.'
        ],
        'rules.sec.item': ['情境规则（条件 → 台词 / 动作）', 'Contextual rules (condition → line / action)'],
        'rules.sec.item.desc': [
            '同样按顺序判断，第一条命中就说这句话、做这个动作；停用的规则会被跳过。',
            'Also evaluated top to bottom; the first match speaks the line / plays the action. Disabled rules are skipped.'
        ],
        'rules.enabled': ['启用', 'On'],
        'rules.enabledTip': [
            '取消勾选 = 停用这条规则（保留在配置里，但不参与判断）',
            'Uncheck to disable: the rule stays in the config but is skipped at runtime'
        ],
        'rules.count': [' 条', ' rules'],

        'unit.pcs': ['个', 'pcs'],
        'unit.lines': ['句', 'lines'],
        'unit.items': ['条', 'items'],
        'unit.sec': ['秒', 's'],
        'unit.ms': ['毫秒', 'ms'],
        'unit.px': ['px', 'px'],
        'cat.title': ['待机分类', 'Idle categories'],
        'cat.night': ['夜间分类', 'Night categories'],
        'cat.desc': ['按权重随机抽取；权重越大出现越频繁。',
                     'Picked by weight; larger weights appear more often.'],
        'cat.name': ['分类名', 'Name'],
        'cat.weight': ['权重', 'Weight'],
        'cat.actions': ['包含的动画（逗号分隔）', 'Clips (comma separated)'],
        'cat.add': ['＋ 添加分类', '+ Category'],
        'hist.title': ['历史版本', 'History'],
        'hist.desc': ['每次保存前自动留一份，最多 20 份。',
                      'A snapshot is taken before every save, up to 20 kept.'],
        'hist.close': ['关闭', 'Close'],
        'hist.restore': ['恢复', 'Restore'],
        'cfg.parsePaste': ['解析粘贴内容', 'Parse pasted YAML'],
        'zone.list': ['分区', 'Zones'],

        'zone.parentTip': ['留空表示顶层', 'Empty = top level'],
        'zone.copyTip': ['复制到 config/pet.yaml（zones 与 zoneReactions 两段），再运行 node tools/build-config.js。',
                         'Paste into config/pet.yaml (zones and zoneReactions), then run node tools/build-config.js.'],
        'zone.undo': ['撤销', 'Undo'],
        'zone.redo': ['重做', 'Redo'],
        'zone.copy': ['复制', 'Copy'],
        'rules.copyTip': ['上半段是 policy.stateRules（与 policy 下其它键并列），下半段是 rules.items。',
                          'Paste into rules.items: in config/pet.yaml, then run node tools/build-config.js.'],
        'cfg.opening': ['正在读取配置…', 'Loading settings…'],
        'cfg.noClip': ['（不播动画）', '（none）'],
    'cfg.unset': ['（未设置）', '（not set）'],
    'cfg.pick': ['（选择…）', '（choose…）'],
    'cfg.manual': ['手动输入…', 'Type a path…'],
    'cfg.customPath': ['自定义路径', 'Custom path'],
    'cfg.selectAll': ['全选', 'All'],
    'cfg.clearAll': ['清空', 'Clear'],
    'cfg.missingClip': ['配置里有，但磁盘上找不到这个动画', 'In the config but missing on disk'],
    'cfg.noAssets': ['素材清单未加载，可手动输入', 'Asset list not loaded — type it manually'],
    'cfg.stateMissingClip': ['缺 clip', 'no clip'],
    'cfg.stateEmptyPool': ['池是空的', 'empty pool'],
    'cfg.weight': ['权重', 'Weight'],
    'cfg.weightZero': ['权重 0 = 不会被随机选中', 'Weight 0 = never picked at random'],
    'cfg.clipCount': ['个动画', 'clips'],
    'cfg.edit': ['编辑', 'Edit'],
    'cfg.collapse': ['收起', 'Collapse'],
    'cfg.pool': ['池', 'pool'],
    'cfg.incomplete': ['不完整', 'incomplete'],
    'cfg.states': ['状态', 'States'],
    'cfg.statesDesc': ['每种状态播哪个动画，以及待机时从哪些动画里抽。', 'Which clip each state plays, and which clips it draws from.'],
    'cfg.stateId': ['状态 id（决定 rollWeights 里的权重键）', 'State id (the key used by rollWeights)'],
    'cfg.delState': ['删除状态', 'Delete state'],
    'cfg.addState': ['＋ 添加状态', '+ State'],
    'cfg.noStates': ['配置里还没有 states。', 'No states in the config yet.'],
    'cfg.diskMissing': ['（磁盘上没有）', '（missing on disk）'],
    'cfg.openFile': ['打开 YAML', 'Open YAML'],
        'zone.look': ['外观', 'Appearance'],
    'zone.cParent': ['父分区色', 'Parent colour'],
    'zone.cChild': ['子分区色', 'Child colour'],
    'zone.cSel': ['选中色', 'Selection colour'],
    'zone.cFill': ['填充透明度', 'Fill opacity'],
    'zone.labelColor': ['标签文字色', 'Label text colour'],
    'zone.labelBg': ['标签底色', 'Label background'],
    'zone.labelSize': ['标签字号', 'Label size'],
    'zone.labelShow': ['显示标签', 'Show labels'],
    'zone.labelShowTip': ['在分区内显示 id', 'Show zone id inside the box'],
    'zone.bg': ['底图', 'Backdrop image'],
    'zone.bgTip': ['只用于对齐，分区是归一化坐标，换图不影响已划分的结果。', 'Alignment only: zones use normalised coordinates, so swapping the image keeps every zone.'],
    'zone.bgPick': ['选择图片', 'Pick image'],
    'zone.bgOpen': ['打开图片', 'Open image'],
    'zone.bgPath': ['图片地址', 'Image path'],
    'zone.bgOpacity': ['不透明度', 'Opacity'],
    'zone.resetBg': ['恢复默认底图', 'Reset backdrop'],
    'zone.resetLook': ['恢复默认外观', 'Reset appearance'],
    'zone.delSelected': ['删除选中分区（Del）', 'Delete selected (Del)'],
    'zone.drawMode': ['＋ 框选新建', '＋ Draw new'],
    'zone.drawHint': ['在图上拖出一个矩形，松手即成新分区（Shift 也可临时框选）', 'Drag a rectangle over the character; release to create a zone (Shift also works)'],
    'zone.parent': ['父分区', 'Parent zone'],
    'zone.actCustom': ['自定义动作', 'Custom action'],
    'zone.width': ['横向范围', 'Horizontal span'],
    'zone.full': ['占满宽度', 'Full width'],
    'zone.idErr': ['id 不能为空、不能重复，也不能含空格', 'id must be non-empty, unique and contain no spaces'],
    'zone.act': ['触发动作', 'Action'],
        'zone.say': ['点击台词（每行一条；台词*2 表示权重 2）', 'Click lines (one per row; text*2 sets weight 2)'],
        'zone.help': ['使用说明', 'How to use'],
        'zone.help.body': [
            '<b>新建</b><br>' +
            '· 按 <kbd>N</kbd> 或点「＋ 框选新建」，在图上拖出矩形；按住 <kbd>Shift</kbd> 拖动可临时框选。<br>' +
            '· 双击任意分区内部，会在点击处建一个子分区，父级就是被双击的那个。<br>' +
            '· 「＋ 子分区」建一个居中的默认框。<br>' +
            '<b>选择与编辑</b><br>' +
            '· 单击选中；<kbd>Shift</kbd> / <kbd>Ctrl</kbd> 单击可多选，右侧可改 id、坐标、父级、动作、台词。<br>' +
            '· 拖动方块移动；八个手柄拉伸（四角 + 四边中点）。<br>' +
            '· 多选时拖动任意一个，整组一起移动。<br>' +
            '<b>删除</b>：<kbd>Del</kbd> 或 <kbd>Backspace</kbd> 删除选中；子分区会自动升到顶层。<br>' +
            '<b>撤销</b>：<kbd>Ctrl</kbd>+<kbd>Z</kbd> 撤销，<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> 或 <kbd>Ctrl</kbd>+<kbd>Y</kbd> 重做。<br>' +
            '<b>取消</b>：<kbd>Esc</kbd> 依次退出框选模式、放弃正在拖的矩形、回到单选。<br>' +
            '<b>外观与底图</b><br>' +
            '· 「外观」改配色、标签样式；「底图」只用于对齐，换图不影响已划分的分区（坐标是归一化的比例）。<br>' +
            '· 本地选的图片只存在本机浏览器，不会写进仓库。<br>' +
            '<b>保存</b>：点「保存并编译」直接写回 <code>config/pet.yaml</code>；没有服务器时用「导出 YAML」手动合并。<br>' +
            '提示：子分区 id 用 <code>head.crown</code> 这种点号层级，会自动继承父分区的反应。<br>' +
            '<b>父级有两种写法</b>：id 里带点号（<code>head.crown</code>）会自动推出父级；' +
            '也可以单独填 <code>parent</code>，显式写的优先级更高——id 起名如 <code>crown</code> 时就得靠它。<br>' +
            '<b>坐标是比例</b>：0~1 的归一化值，跟素材尺寸无关，换立绘不用重画。<br>' +
            '<b>页面打开时读的是真实配置</b>：启动会先读 <code>config/pet.yaml</code> 里的 zones / zoneReactions，' +
            '读不到才用内置默认分区；保存同样会先比对磁盘，避免覆盖别人的改动。<br>' +
            '<b>恢复出厂默认</b>只替换 zones 与 zoneReactions 两段，其它配置不动。',
            '<b>Create</b><br>' +
            '· Press <kbd>N</kbd> or click "＋ Draw new", then drag a rectangle; hold <kbd>Shift</kbd> to draw without toggling.<br>' +
            '· Double-click inside a zone to add a child at that point; its parent is the zone you clicked.<br>' +
            '· "＋ Child zone" drops a default box in the middle.<br>' +
            '<b>Select &amp; edit</b><br>' +
            '· Click to select; <kbd>Shift</kbd> / <kbd>Ctrl</kbd> click to multi-select. Edit id, coordinates, parent, action and dialogue on the right.<br>' +
            '· Drag the box to move it; eight handles resize it (corners + edge midpoints).<br>' +
            '· With several selected, dragging one moves the whole group.<br>' +
            '<b>Delete</b>: <kbd>Del</kbd> or <kbd>Backspace</kbd>; children are promoted to top level.<br>' +
            '<b>Undo</b>: <kbd>Ctrl</kbd>+<kbd>Z</kbd>, redo with <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> or <kbd>Ctrl</kbd>+<kbd>Y</kbd>.<br>' +
            '<b>Cancel</b>: <kbd>Esc</kbd> leaves draw mode, drops the rectangle being dragged, then returns to single selection.<br>' +
            '<b>Look &amp; backdrop</b><br>' +
            '· "Appearance" changes colours and label style; the backdrop is alignment only — zones are normalised, so swapping images keeps every zone.<br>' +
            '· A locally picked image stays in this browser; nothing is written to the repo.<br>' +
            '<b>Save</b>: "Save &amp; build" writes <code>config/pet.yaml</code>; without a server use "Export YAML".<br>' +
            'Tip: dotted ids like <code>head.crown</code> inherit the parent reaction.<br>' +
            '<b>Two ways to declare a parent</b>: dots in the id (<code>head.crown</code>) imply the parent, and an ' +
            'explicit <code>parent</code> field wins over that — needed when the id is a plain name like <code>crown</code>.<br>' +
            '<b>Coordinates are ratios</b>: normalised 0~1, independent of the artwork size, so a new drawing needs no ' +
            're-tracing.<br>' +
            '<b>It reads the real config</b>: zones and zoneReactions are loaded from <code>config/pet.yaml</code> at ' +
            'startup (the built-in array is only a fallback), and saving compares against the file on disk first.<br>' +
            '<b>Factory defaults</b> replace only zones and zoneReactions; everything else stays put.'
        ],

        'rules.title': ['规则编辑器', 'Rules editor'],
        'rules.add': ['＋ 规则', '+ Rule'],
        'rules.import': ['导入 YAML', 'Import YAML'],
        'rules.export': ['导出 YAML', 'Export YAML'],
        'rules.copy': ['复制', 'Copy'],
        'rules.loading': ['加载中…', 'Loading…'],
        'rules.condAll': ['条件（全部满足）', 'Conditions (all must match)'],
        'rules.addCond': ['＋ 条件', '+ Condition'],
        'rules.say': ['台词（每行一条，随机取）', 'Dialogue (one per row, picked at random)'],
        'rules.act': ['动作（多个用逗号分隔，留空不切动画）', 'Action (comma-separated; empty = no animation)'],
        'rules.cd': ['冷却（秒，留空跟随默认）', 'Cooldown (seconds; empty = default)'],
        'rules.exportTip': ['复制到 config/pet.yaml 的 rules.items:，再运行 node tools/build-config.js。',
                            'Paste into rules.items: in config/pet.yaml, then run node tools/build-config.js.'],
        'rules.weightsAllZero': ['全部为 0：只按规则进入，不做随机', 'All zero: entered by rules only, never rolled at random'],
    'rules.weightsTotal': ['总权重 {n}，上面的条按比例显示', 'Total weight {n}; the bar above shows the shares'],
    'rules.actPick': ['动作（点选，可多选；都不选则不切动画）', 'Action (click to pick several; none = no animation)'],
    'rules.custom': ['自定义…', 'Custom…'],
    'rules.condKey': ['条件键名', 'Condition key'],
    'rules.condUnknown': ['运行时不认识这个键', 'The runtime does not know this key'],
    'rules.clear': ['清空', 'Clear'],
    'rules.noClips': ['没连服务器，只能手填', 'No server — type it manually'],
    'rules.weights': ['状态权重', 'State weights'],
    'rules.weightsDesc': ['规则没命中时按权重随机；0 = 不会被随机选中。', 'Without a matching rule the state is rolled by weight; 0 = never picked.'],
    'rules.noStates': ['（配置里没有 states）', '（no states in the config）'],
    'rules.help': ['使用说明', 'How to use'],
        'rules.help.body': [
            '1. 每条规则从上到下依次判断，先命中先生效。<br>' +
            '2. 条件越具体越该放前面，兜底规则放最后。<br>' +
            '3. 台词可以多行，随机取一条；支持 <code>{tag}</code> 与 <code>{streak}</code> 占位。<br>' +
            '4. 点「保存并编译」直接写回；没有服务器时才需要导出 YAML。<br>' +
            '提示：冷却时间越短越热闹，太长会显得安静。<br>' +
            '<b>两个上下区不一样</b>：上面「状态规则」决定她处于什么状态（条件 → 状态），' +
            '下面「情境规则」决定她说哪句、做哪个动作（条件 → 台词 / 动作）。两组都按从上到下的顺序判定，先命中先生效。<br>' +
            '<b>启用开关</b>：每条规则左边的勾选框对应 YAML 里的 <code>enabled: false</code>——' +
            '取消勾选后规则仍保留在配置里，只是运行时跳过，不用删掉再手抄回来。<br>' +
            '<b>没有状态规则命中时</b>，会按各状态自己的 <code>weight</code> 加权随机。<br>' +
            '<b>保存</b>只替换 <code>rules.items</code> 与 <code>policy.stateRules</code>，' +
            '<code>policy</code> 下的 rollWeights / calendar 不受影响；没成功读取配置时保存会被拦下，' +
            '避免写出一份空规则。',
            '1. Rules are evaluated top to bottom; the first match wins.<br>' +
            '2. Put specific conditions first and keep a fallback last.<br>' +
            '3. Multiple lines are picked at random; <code>{tag}</code> and <code>{streak}</code> are supported.<br>' +
            '4. Ctrl+Z undoes a drag, Ctrl+Shift+Z or Ctrl+Y redoes it.<br>' +
            '5. Click "Save & build" to write it back; export only if you have no server.<br>' +
            'Tip: short cooldowns feel lively, long ones feel quiet.<br>' +
            '<b>The two sections differ</b>: "State rules" decide which state she is in (condition → state); ' +
            '"Contextual rules" decide what she says or does (condition → line / action). Both are evaluated top to ' +
            'bottom and the first match wins.<br>' +
            '<b>The On switch</b> maps to <code>enabled: false</code> in the YAML: the rule stays in the config but ' +
            'is skipped at runtime, so you can silence it without deleting and retyping it.<br>' +
            '<b>When no state rule matches</b>, states are picked by their own <code>weight</code>.<br>' +
            '<b>Saving</b> replaces only <code>rules.items</code> and <code>policy.stateRules</code>; rollWeights and ' +
            'the calendar under <code>policy</code> are untouched. If the config was never loaded, saving is blocked ' +
            'so it cannot write an empty rule list.'
        ],

        'tests.clear': ['清空输出', 'Clear output'],
    'tests.passedSuites': ['通过', 'Passed'],
    'tests.unitTitle': ['单元测试', 'Unit tests'],
    'tests.unitHint': ['纯函数与数据校验，毫秒级', 'Pure functions and data checks, milliseconds'],
    'tests.e2eTitle': ['端到端', 'End to end'],
    'tests.e2eHint': ['无头浏览器，秒级', 'Headless browser, seconds'],
    'tests.runOne': ['运行', 'Run'],
    'tests.suite.kernel': ['内核', 'Kernel'],
    'tests.suite.rules': ['规则编译器', 'Rule compiler'],
    'tests.suite.rulesData': ['规则数据', 'Rule data'],
    'tests.suite.levels': ['意图级别', 'Intent levels'],
    'tests.suite.statesWeights': ['状态权重', 'State weights'],
    'tests.suite.statesData': ['状态数据', 'State data'],
    'tests.suite.zones': ['分区引擎', 'Zone engine'],
    'tests.suite.smoke': ['端到端冒烟', 'Smoke (e2e)'],
    'tests.suite.i18n': ['中英一致性', 'zh/en consistency'],
    'tests.title': ['宠物测试', 'Pet tests'],
    'tests.idle': ['等待运行', 'Ready'],
    'tests.running': ['运行中…', 'Running…'],
    'tests.done': ['完成', 'Done'],
    'tests.failed': ['失败', 'Failed'],
    'tests.noServerShort': ['没有服务器', 'No server'],
    'tests.noServer': ['连不上本地服务器。请用 start.bat 启动后再试。', 'Cannot reach the local server. Start it with start.bat and try again.'],
    'tests.runUnit': ['跑全部单元', 'Run all unit tests'],
    'tests.runAll': ['全量（含冒烟与中英一致性）', 'Full (smoke + zh/en)'],
    'tests.panelTitle': ['测试面板', 'Test panel'],
    'tests.panelDesc': ['每个套件可以单独跑，也可以一次跑全部。需要本地服务器（start.bat）。', 'Run any suite on its own, or all of them in one go. Requires the local server (start.bat).'],
    'tests.badgeIdle': ['未运行', 'Not run'],
    'tests.badgeOk': ['通过', 'Passed'],
    'tests.badgeFail': ['失败', 'Failed'],
    'tests.outputTitle': ['输出', 'Output'],
    'tests.duration': ['耗时', 'Took'],
    'tests.outputPlaceholder': ['（还没有输出）', '(no output yet)'],
    'tests.hint': ['命令行等价：<code>node tools/run-tests.js --all</code>', 'CLI equivalent: <code>node tools/run-tests.js --all</code>'],
    'home.tests': ['测试面板', 'Test panel'],
    'home.tests.desc': ['单元、冒烟、中英一致性，一键跑', 'Unit, smoke and zh/en checks in one click'],
    'nav.readme': ['使用说明', 'Readme'],
        'nav.status': ['项目状态', 'Status'],
        'nav.api': ['API 文档', 'API'],
        'nav.tests': ['测试面板', 'Test panel'],
    'nav.interaction': ['交互协议（设计稿）', 'Interaction (draft)'],
    'nav.issues': ['已知问题', 'Issues'],
        'nav.history': ['开发沿革', 'History'],

        'docs.back': ['← 返回', '← Back'],
        'lang.toggle': ['EN', '中文']
    };

    var TERMS = {
        '气泡和对话里的自称': 'How it refers to itself in bubbles and chat',
        '换掉会让访客记录、位置、聊天全部重置': 'Changing this resets visit history, position and chat',
        '透明 WebM 放这里': 'Transparent WebM files live here',
        '首帧或无法播放时的静帧': 'Still frame shown first, or when playback fails',
        '正数向右；偏左就调大': 'Positive moves right; raise it if the art sits left',
        '越大越"飘在上面"': 'Larger lifts the shadow away',
        '越大越柔和': 'Larger is softer',
        '带透明度的颜色值': 'Colour with alpha',
        '单位毫秒；9000 = 9 秒': 'Milliseconds; 9000 = 9 s',
        '实际间隔在上限与下限之间随机': 'Actual delay is random between min and max',
        '无操作累计到这个时间': 'Idle time before it falls asleep',
        '关掉之后只能点': 'When off, clicking still works',
        '位移超过这个值才算拖，否则算点': 'Moves beyond this count as a drag, otherwise a click',
        '点一次飘出的爱心/水滴数量': 'Particles per click',
        '情境台词会覆盖这个值': 'Context lines override this',
        '读到底、换页这类主动说话': 'Proactive lines such as reaching the end',
        '这段时间内同一句不重复说': 'The same line is not repeated within this window',
        '说不过来时最多积压几句': 'How many lines may queue up',
        '超出后丢弃最早的': 'Oldest entries are dropped first',
        '越小越活泼，越大越安静': 'Smaller is livelier, larger is quieter',
        '构建期生成的 JSON': 'JSON generated at build time',
        '首屏多久后静默加载索引': 'Silently load the index after this delay',
        '问答里列出的结果数量': 'Number of results listed',
        '一直循环的动画': 'Looped while idle',
        '被点时的候选': 'Candidates on click',
        '抓起时播的那一个': 'Played when grabbed',
        '进入休眠播一次': 'Played once on falling asleep',
        '点喂食按钮播一次': 'Played once on feeding',
        '它在对话里怎么称呼自己，以及状态存在哪个键下面。': 'How it names itself, and where its state is stored.',
        '素材位置与投影。角色看起来偏左或偏右，调「水平偏移」。': 'Asset paths and shadow. Adjust horizontal offset if the art sits off-centre.',
        '她多久换一次待机小动作，以及多久没人理就睡着。': 'How often it changes idle animation, and how soon it naps.',
        '点击与拖拽怎么区分，点一下飘出几个粒子。': 'How click and drag are told apart, and particles per click.',
        '说话的节奏：同一句多久内不重复、气泡停留多久、对话保留几条。': 'Speech timing: dedupe window, bubble duration, chat history.',
        '每条规则触发一次后，需要等多久才可能再次触发。': 'How long a rule waits before it may fire again.',
        '对话里问「有没有讲 X 的」时，去哪找索引。': 'Where to look when asked about a topic.',
        '待机时从哪些动画里抽。改这里等于改她的性格。': 'Which clips idle picks from. This is its personality.',
        '按权重随机抽取；权重越大出现越频繁。': 'Picked by weight; larger weights appear more often.',
        '个': 'pcs', '句': 'lines', '条': 'items', '秒': 's', '毫秒': 'ms',
        '名字': 'Name', '存储键': 'Storage key', '身份': 'Identity', '外观': 'Appearance',
        '节奏': 'Timing', '交互': 'Interaction', '语言': 'Speech', '情境规则': 'Context rules',
        '站内检索': 'Site search', '动作库': 'Animation pool', '待机分类': 'Idle categories',
        '夜间分类': 'Night categories', '水平偏移': 'Horizontal offset', '垂直偏移': 'Vertical offset',
        '模糊半径': 'Blur radius', '颜色': 'Color', '动画目录': 'Animation dir', '占位图': 'Poster',
        '换动作间隔（最短）': 'Idle roll (min)', '换动作间隔（最长）': 'Idle roll (max)',
        '多久后睡着': 'Sleep after', '允许拖拽': 'Allow drag', '拖拽判定距离': 'Drag threshold',
        '点击粒子数': 'Click particles', '气泡停留': 'Bubble duration', '情境台词停留': 'Context line duration',
        '防重复窗口': 'Dedupe window', '待说队列上限': 'Queue limit', '对话保留条数': 'Chat history',
        '默认冷却': 'Default cooldown', '索引地址': 'Index URL', '预取延迟': 'Preload delay',
        '最多返回几条': 'Max results',
        '站点对接': 'Site integration', '就绪延迟': 'Ready delay', '读取文章元信息': 'Read post metadata',
        '404': '404', '收藏这页': 'Bookmark this page', '带模拟站点重载': 'Reload with mock site',
        '切主题': 'Toggle theme',
        '对话里问「有没有讲 X 的」时，检索请求交给站点的 SiteAPI（收录哪些内容由站点决定，宠物不维护索引）。':
            'When you ask "do you have anything on X", the query goes to the site SiteAPI — the site decides what is indexed; the pet keeps no index.',
        '宠物只通过 window.SiteAPI 与站点对话，这里没有任何可调项：页面类型、标签、字数、主题都由站点在 currentContext() 里给。':
            'The pet talks to the site only through window.SiteAPI. Nothing to tune here: page type, tags, word count and theme all come from currentContext().',
        'SiteAPI.ready() 会让站点加载内容库，延迟执行可以避开首屏':
            'SiteAPI.ready() makes the site load its content library, so it runs after first paint',
        '文章页按需取标签与字数（走内容库，一页只取一次）；关掉后相关台词不会出现':
            'On post pages, fetch tags and word count on demand (one lookup per page); turn it off and those lines never appear', '常驻待机': 'Idle loop', '点击回应': 'Click replies',
        '拖拽动画': 'Drag clip', '睡着时': 'Sleep clip', '喂食时': 'Feed clip',
        '页面类型': 'Page type', '细分类型': 'Sub type', '标签包含': 'Tags include',
        '字数 >': 'Words >', '字数 <': 'Words <', '评论数 =': 'Comments =', '评论数 ≥': 'Comments ≥',
        '滚动 >': 'Scroll >', '滚动 <': 'Scroll <', '上次滚动 >': 'Prev scroll >',
        '暗色主题': 'Dark mode', '小时 ≥': 'Hour ≥', '小时 <': 'Hour <', '连续天数 ≥': 'Streak ≥'
    };

    var lang = (function () {
        try {
            return localStorage.getItem('pet-i18n') || ((navigator.language || 'zh').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en');
        } catch (e) { return 'zh'; }
    })();

    function t(zh) {
        if (lang === 'zh') return zh;
        if (TERMS[zh]) return TERMS[zh];
        var k = Object.keys(STR).find(function (key) { return STR[key][0] === zh; });
        if (k) return STR[k][1];
        return zh;
    }

    function s(key) {
        var v = STR[key];
        if (!v) return key;
        return lang === 'zh' ? v[0] : v[1];
    }

    var listeners = [];

    function apply() {
        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            var key = el.getAttribute('data-i18n');
            if (!STR[key]) return;                 // 缺词条就保留原文，绝不显示 key
            var val = s(key);
            if (el.hasAttribute('data-i18n-html')) el.innerHTML = val;
            else el.textContent = val;
        });
        var tk = document.body.getAttribute('data-title-key');
        if (tk && STR[tk]) document.title = s(tk);
        document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
            var key = el.getAttribute('data-i18n-placeholder');
            if (STR[key]) el.setAttribute('placeholder', s(key));
        });
        document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
        listeners.forEach(function (fn) { try { fn(lang); } catch (e) { /* ignore */ } });
    }

    function setLang(next) {
        lang = next;
        try { localStorage.setItem('pet-i18n', lang); } catch (e) { /* ignore */ }
        apply();
        // 说明面板是拼出来的 HTML，apply() 不认识它，得手动重建
        try { buildHelp(); } catch (e) { /* ignore */ }
    }

    function toggle() { setLang(lang === 'zh' ? 'en' : 'zh'); }

    function mountToggle() {
        var header = document.querySelector('header');
        if (document.querySelector('.i18n-btn')) return;
        var btn = document.createElement('button');
        btn.className = 'i18n-btn';
        btn.type = 'button';
        btn.textContent = s('lang.toggle');
        btn.style.cssText = 'font:inherit;font-size:12.5px;padding:5px 10px;border:1px solid #dde5f0;background:#fff;border-radius:7px;cursor:pointer;color:#4a5769';
        if (!header) {
            btn.style.cssText += ';position:fixed;top:16px;right:18px;z-index:50;box-shadow:0 2px 8px rgba(30,50,90,.12)';
            document.body.appendChild(btn);
        }
        btn.addEventListener('click', function () {
            toggle();
            btn.textContent = s('lang.toggle');
            document.querySelectorAll('[data-i18n]').forEach(function (el) { /* noop */ });
            var again = document.querySelectorAll('.help-panel');
            again.forEach(function (p) { p.dataset.built = ''; });
            buildHelp();
        });
        if (header) header.appendChild(btn);
    }

    /* 使用说明：给每个编辑器注入一个可折叠面板 */
    function buildHelp() {
        var host = document.querySelector('main');
        var key = document.body.dataset.helpKey;
        if (!host || !key || !STR[key + '.help']) return;
        var existing = document.querySelector('.help-panel');
        if (existing) existing.remove();
        var details = document.createElement('details');
        details.className = 'help-panel';
        details.style.cssText = 'grid-column:1/-1;margin:0 0 16px;background:#fff;border:1px solid #e3e9f3;border-radius:12px;padding:12px 18px;font-size:13px;line-height:1.85;color:#3f4c5f';
        details.innerHTML = '<summary style="cursor:pointer;font-weight:600;color:#1f2a37">' +
            s(key + '.help') + '</summary><div style="margin-top:8px">' + s(key + '.help.body') + '</div>';
        host.insertBefore(details, host.firstChild);
    }

    global.PetI18n = {
        get lang() { return lang; },
        t: t,
        s: s,
        setLang: setLang,
        toggle: toggle,
        apply: apply,
        onChange: function (fn) { listeners.push(fn); }
    };

    document.addEventListener('DOMContentLoaded', function () {
        apply();
        mountToggle();
        buildHelp();
    });
})(window);
