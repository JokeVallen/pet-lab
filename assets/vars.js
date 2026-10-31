/*!
 * assets/vars.js —— 文案占位符的说明书
 *
 * 这里是**唯一**的变量清单：文案编辑页的按钮、变量表页面都读它。
 * 运行时那份取值在 js/pet/index.js 的 placeholderVars()，两边由
 * tools/manual/check-vars-doc.js 对账，少一个就报。
 *
 * 字段：
 *   key    占位符名（不带花括号）
 *   group  分组：role / visit / time / page / ctx
 *   zh/en  给人看的含义
 *   ex     预览与示例用的值（会随语言切换取 exEn）
 *   src    值从哪来
 *   empty  什么情况下是空的（没有则省略）
 */
(function () {
    'use strict';

    var GROUPS = [
        { id: 'role', zh: '角色', en: 'Character', desc: { zh: '她是谁。改 persona.name 时，所有引用它的句子一起变。', en: 'Who she is. Renaming her updates every line that references it.' } },
        { id: 'visit', zh: '来访', en: 'Visits', desc: { zh: '本机记录的状态：连续天数、好感度、饱腹度、被摸次数。', en: 'Local state: streak, affinity, fullness, times petted.' } },
        { id: 'time', zh: '时间', en: 'Time', desc: { zh: '当前时刻，不需要站点。', en: 'Current time; no site needed.' } },
        { id: 'page', zh: '页面', en: 'Page', desc: { zh: '访客正在看的页面。没有接入 SiteAPI 时这些是空的。', en: 'What the visitor is reading. Empty without SiteAPI.' } },
        { id: 'ctx', zh: '语境', en: 'Context', desc: { zh: '不是宠物名：由调用点临时传入，比如标签名。', en: 'Not the pet name: passed in by the caller, e.g. a tag name.' } }
    ];

    var LIST = [
        { key: 'pet', group: 'role', zh: '名字', en: 'Name', ex: '小鲸', exEn: 'Whale', src: 'persona.name' },
        { key: 'alt', group: 'role', zh: '副名', en: 'Subname', ex: '鲸鱼娘小鲸', exEn: 'the whale girl', src: 'persona.alt' },

        { key: 'n', group: 'visit', zh: '连续来访天数', en: 'Streak days', ex: '3', exEn: '3', src: '本机记录', srcEn: 'local record' },
        { key: 'streak', group: 'visit', zh: '同 {n}', en: 'Alias of {n}', ex: '3', exEn: '3', src: '本机记录', srcEn: 'local record' },
        { key: 'affinity', group: 'visit', zh: '好感度 0–100', en: 'Affinity 0–100', ex: '42', exEn: '42', src: '本机记录', srcEn: 'local record' },
        { key: 'fullness', group: 'visit', zh: '饱腹度 0–100', en: 'Fullness 0–100', ex: '72', exEn: '72', src: '本机记录', srcEn: 'local record' },
        { key: 'pets', group: 'visit', zh: '被摸次数', en: 'Times petted', ex: '18', exEn: '18', src: '本机记录', srcEn: 'local record' },

        { key: 'greeting', group: 'time', zh: '时段问候', en: 'Time-of-day greeting', ex: '晚上好', exEn: 'Good evening', src: '当前钟点', srcEn: 'current hour' },
        { key: 'hour', group: 'time', zh: '小时（0–23）', en: 'Hour (0–23)', ex: '21', exEn: '21', src: '当前时间', srcEn: 'now' },
        { key: 'time', group: 'time', zh: '时分 HH:mm', en: 'Time HH:mm', ex: '21:30', exEn: '21:30', src: '当前时间', srcEn: 'now' },
        { key: 'weekday', group: 'time', zh: '星期', en: 'Weekday', ex: '周五', exEn: 'Fri', src: '当前时间', srcEn: 'now' },
        { key: 'date', group: 'time', zh: '日期 YYYY-MM-DD', en: 'Date YYYY-MM-DD', ex: '2026-10-29', exEn: '2026-10-29', src: '当前时间', srcEn: 'now' },

        { key: 'pageName', group: 'page', zh: '页面类型的可读名', en: 'Readable page type', ex: '文章', exEn: 'article', src: 'SiteAPI context.type 再翻译', srcEn: 'SiteAPI context.type, translated', empty: { zh: '没有站点时取「页面」', en: 'falls back to “page” without a site' } },
        { key: 'type', group: 'page', zh: '页面类型原始值', en: 'Raw page type', ex: 'post', exEn: 'post', src: 'SiteAPI context.type', srcEn: 'SiteAPI context.type', empty: { zh: '没有站点时为 other', en: 'other without a site' } },
        { key: 'page', group: 'page', zh: '页面大类', en: 'Page class', ex: 'post', exEn: 'post', src: 'SiteAPI context.page', srcEn: 'SiteAPI context.page', empty: { zh: '没有站点时为 other', en: 'other without a site' } },
        { key: 'title', group: 'page', zh: '当前标题', en: 'Page title', ex: '一篇文章的标题', exEn: 'An article title', src: 'SiteAPI context.title', srcEn: 'SiteAPI context.title', empty: { zh: '首页/无站点时为空', en: 'empty on the home page or without a site' } },
        { key: 'tag', group: 'page', zh: '首个标签', en: 'First tag', ex: 'Unity', exEn: 'Unity', src: 'SiteAPI context.tags[0]', srcEn: 'SiteAPI context.tags[0]', empty: { zh: '没有标签时为空', en: 'empty when untagged' } },
        { key: 'tags', group: 'page', zh: '全部标签（顿号连接）', en: 'All tags (joined)', ex: 'Unity、笔记', exEn: 'Unity, Notes', src: 'SiteAPI context.tags', srcEn: 'SiteAPI context.tags', empty: { zh: '没有标签时为空', en: 'empty when untagged' } },
        { key: 'category', group: 'page', zh: '首个分类', en: 'First category', ex: '技术', exEn: 'Tech', src: 'SiteAPI context.categories[0]', srcEn: 'SiteAPI context.categories[0]', empty: { zh: '没有分类时为空', en: 'empty without a category' } },
        { key: 'words', group: 'page', zh: '字数', en: 'Word count', ex: '1200', exEn: '1200', src: 'SiteAPI context.words', srcEn: 'SiteAPI context.words', empty: { zh: '没有站点时为 0', en: '0 without a site' } },
        { key: 'minutes', group: 'page', zh: '预计阅读分钟', en: 'Reading minutes', ex: '4', exEn: '4', src: '字数 ÷ ui.wordsPerMinute（默认 300）', srcEn: 'words ÷ ui.wordsPerMinute (300)', empty: { zh: '没有站点时为 1', en: '1 without a site' } },
        { key: 'percent', group: 'page', zh: '阅读进度 %', en: 'Scroll progress %', ex: '45', exEn: '45', src: 'SiteAPI 滚动位置', srcEn: 'SiteAPI scroll ratio', empty: { zh: '没有站点时为 0', en: '0 without a site' } },
        { key: 'comments', group: 'page', zh: '评论数', en: 'Comment count', ex: '8', exEn: '8', src: 'SiteAPI context.comments', srcEn: 'SiteAPI context.comments', empty: { zh: '不知道时为空（不是 0）', en: 'empty when unknown (not 0)' } },

        { key: 'name', group: 'ctx', zh: '语境名（如标签名）', en: 'Contextual name (e.g. a tag)', ex: 'Unity', exEn: 'Unity', src: '调用点传入', srcEn: 'passed by the caller', empty: { zh: '没传就保留原样', en: 'stays literal when not passed' } }
    ];

    /* 表达式写法：假设 pet=小鲸、title=一篇文章的标题、tag 为空 */
    var SYNTAX = [
        {
            code: '{pet}',
            zh: '直接取值。变量不存在时原样保留，方便发现写错的名字。',
            en: 'Plain value. Unknown names are left as-is so typos are visible.',
            result: '小鲸'
        },
        {
            code: "{title?'读《{title}》':'随便逛逛'}",
            zh: '有值用前段，没有用后段。分支里还能嵌占位符。',
            en: 'First branch when set, second when empty. Branches may nest placeholders.',
            result: '读《一篇文章的标题》'
        },
        {
            code: "{tag??'这页没有标签'}",
            zh: '空值合并：有值就用值本身，没有才用后备。',
            en: 'Nullish: keep the value when set, use the fallback otherwise.',
            result: '这页没有标签'
        },
        {
            code: "{!title?'还没打开文章':'正在读{title}'}",
            zh: '变量名前加 ! 表示取反。',
            en: 'A leading ! negates the condition.',
            result: '正在读一篇文章的标题'
        },
        {
            code: '{comments?有{comments}条评论:还没有评论}',
            zh: '数字 0 也算"没有"，所以计数类可以直接判断。',
            en: 'The number 0 counts as empty, so numeric checks just work.',
            result: '还没有评论'
        },
        {
            code: "{title?'真的?那就':'不是'}",
            zh: '分支里有问号或冒号时，用引号包起来。',
            en: 'Quote a branch when it contains ? or :.',
            result: '不是'
        }
    ];


    /* 配置字段清单：配置编辑器与 docs/CONFIG.md 共用这一份，
     * 漏写或写错 key 由 tools/check-config-doc.js 对账。 */
    var CFG = [
        { g: 'identity', k: 'persona.name', where: 'config', zh: '对话标题与自称；文案里用 {pet} 引用', ex: '名字', def: '（必填）' },
        { g: 'identity', k: 'name', where: 'config', zh: '内部标识，只用于日志与兜底，改它不改称呼', def: '（必填）' },
        { g: 'identity', k: 'storageKey', where: 'config', zh: '本机存档键；换掉会让访客记录、位置、聊天全部重置', def: 'pet-v1' },
        { g: 'identity', k: 'hostId', where: 'config', zh: '挂载点 id；同页放多月实例时每只都要不同', def: 'pet' },
        { g: 'look', k: 'animDir', where: 'config', zh: '透明动画目录，clip 名拼在它后面', def: '/images/pet/anim/' },
        { g: 'look', k: 'image', where: 'config', zh: '首帧占位图；不支持 WebM 时也用它', def: '/images/pet/anim/poster.webp' },
        { g: 'look', k: 'shadow.offsetX', where: 'config', zh: '投影水平偏移，正数向右', def: '0' },
        { g: 'look', k: 'shadow.offsetY', where: 'config', zh: '投影垂直偏移，越大越"飘"', def: '6' },
        { g: 'look', k: 'shadow.blur', where: 'config', zh: '投影模糊半径', def: '10' },
        { g: 'look', k: 'shadow.color', where: 'config', zh: '投影颜色（含透明度）', def: 'rgba(33,72,145,0.16)' },
        { g: 'look', k: 'clipExt', where: 'config', zh: '动画扩展名；播放器目前只吃 WebM', def: 'webm' },
        { g: 'look', k: 'size.width', where: 'config', zh: '立绘框宽，写进 CSS 变量', def: '190' },
        { g: 'look', k: 'size.height', where: 'config', zh: '立绘框高', def: '169' },
        { g: 'look', k: 'accent.primary', where: 'config', zh: '主题色主色', def: '#2f6fed' },
        { g: 'look', k: 'accent.primary2', where: 'config', zh: '主题色渐变末端', def: '#3f9bf5' },
        { g: 'look', k: 'accent.cyan', where: 'config', zh: '点缀色（高亮、光晕）', def: '#7ad9ff' },
        { g: 'beat', k: 'idleRollMs', where: 'config', zh: '待机小动作的间隔区间 [最短, 最长]，毫秒', def: '[9000, 21000]' },
        { g: 'beat', k: 'idleSleepMs', where: 'config', zh: '无操作多久后睡着，毫秒', def: '150000' },
        { g: 'act', k: 'drag.enabled', where: 'config', zh: '能不能拖起来', def: 'true' },
        { g: 'act', k: 'drag.thresholdPx', where: 'config', zh: '移动超过多少像素才算拖拽（否则算点击）', def: '6' },
        { g: 'act', k: 'click.particleCount', where: 'config', zh: '点击时飘出的粒子数量', def: '6' },
        { g: 'voice', k: 'speech.bubbleTtl', where: 'config', zh: '气泡停留时长，毫秒', def: '3200' },
        { g: 'voice', k: 'speech.contextTtl', where: 'config', zh: '情境台词气泡停留时长', def: '6000' },
        { g: 'voice', k: 'speech.dedupeMs', where: 'config', zh: '同一句在这段时间内不重复说', def: '45000' },
        { g: 'voice', k: 'speech.maxQueue', where: 'config', zh: '待说队列上限，积压超过就丢弃', def: '3' },
        { g: 'voice', k: 'chat.maxMessages', where: 'config', zh: '对话框保留多少条历史', def: '20' },
        { g: 'ui', k: 'ui.actionHideDelayMs', where: 'config', zh: '鼠标离开后多久收起动作按钮', def: '320' },
        { g: 'ui', k: 'ui.actionFadeMs', where: 'config', zh: '动作按钮淡入淡出时长', def: '140' },
        { g: 'ui', k: 'ui.wordsPerMinute', where: 'config', zh: '算「要读几分钟」用的每分钟字数', def: '300' },
        { g: 'rule', k: 'rules.defaultCooldown', where: 'config', zh: '情境规则默认冷却，秒', def: '60' },
        { g: 'rule', k: 'rules.items', where: 'rules', zh: '情境规则条目（条件 → 台词 / 动作）', def: '[]' },
        { g: 'search', k: 'search.maxResults', where: 'config', zh: '站内检索最多返回几条', def: '3' },
        { g: 'anim', k: 'animations.idle', where: 'config', zh: '常驻待机动画池', def: '[]' },
        { g: 'anim', k: 'animations.clicks', where: 'config', zh: '被点时随机挑的动画池', def: '[]' },
        { g: 'anim', k: 'animations.drag', where: 'config', zh: '抓起时播的动画', def: '' },
        { g: 'anim', k: 'animations.events.sleep', where: 'config', zh: '进入休眠时播一次', def: '' },
        { g: 'anim', k: 'animations.events.eat', where: 'config', zh: '投喂时播一次', def: '' },
        { g: 'state', k: 'states.*', where: 'config', zh: '每种状态：clip、pool、weight、loop', def: 'idle / sleepy / busy' },
        { g: 'state', k: 'states.*.loop', where: 'config', zh: '只循环片段里的一段 [intro, end]，秒', def: '（整段循环）' },
        { g: 'zone', k: 'zones', where: 'zone', zh: '可点击区域：矩形、标签、层级', def: '[]' },
        { g: 'zone', k: 'zoneReactions', where: 'zone', zh: '每个区域被点时的动作与台词', def: '{}' },
        { g: 'copy', k: 'persona.*', where: 'copy', zh: '全部台词：自我介绍、睡觉、投喂、问候、图标', def: '' },
        { g: 'copy', k: 'persona.en', where: 'copy', zh: '英文台词层，缺的键回落到中文', def: '（无）' },
        { g: 'site', k: 'policy.rollWeights', where: 'manual', zh: '动作随机权重（按事件名）', def: '{}' },
        { g: 'site', k: 'policy.stateRules', where: 'rules', zh: '上下文 → 状态的映射', def: '[]' },
        { g: 'site', k: 'policy.calendar', where: 'manual', zh: '节假日等日历规则', def: '{}' }
    ];

    var CFG_GROUPS = [
        { id: 'identity', zh: '身份', en: 'Identity' },
        { id: 'look', zh: '外观', en: 'Looks' },
        { id: 'beat', zh: '节奏', en: 'Rhythm' },
        { id: 'act', zh: '交互', en: 'Interaction' },
        { id: 'voice', zh: '语言', en: 'Voice' },
        { id: 'ui', zh: '界面', en: 'UI' },
        { id: 'rule', zh: '规则', en: 'Rules' },
        { id: 'search', zh: '检索', en: 'Search' },
        { id: 'anim', zh: '动作库', en: 'Animations' },
        { id: 'state', zh: '状态', en: 'States' },
        { id: 'zone', zh: '分区', en: 'Zones' },
        { id: 'copy', zh: '文案', en: 'Copy' },
        { id: 'site', zh: '站点', en: 'Site' }
    ];

    var PetVars = { groups: GROUPS, list: LIST, syntax: SYNTAX, config: CFG, configGroups: CFG_GROUPS };
    window.PetVars = PetVars;

    /** 按当前语言取字段 */
    PetVars.text = function (item, field, lang) {
        var en = lang === 'en';
        if (field === 'ex') return en ? (item.exEn || item.ex) : item.ex;
        if (field === 'src') return en ? (item.srcEn || item.src) : item.src;
        if (field === 'empty') return item.empty ? (en ? item.empty.en : item.empty.zh) : '';
        return en ? (item[field + 'En'] || item[field]) : item[field];
    };
})();
