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
        { key: 'pet', group: 'role', zh: '名字', en: 'Name', ex: '大肥鱼', exEn: 'Dafeiyu', src: 'persona.name' },
        { key: 'alt', group: 'role', zh: '副名', en: 'Subname', ex: '鲸鱼娘大肥鱼', exEn: 'the whale girl', src: 'persona.alt' },

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

    /* 表达式写法：假设 pet=大肥鱼、title=一篇文章的标题、tag 为空 */
    var SYNTAX = [
        {
            code: '{pet}',
            zh: '直接取值。变量不存在时原样保留，方便发现写错的名字。',
            en: 'Plain value. Unknown names are left as-is so typos are visible.',
            result: '大肥鱼'
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

    window.PetVars = { groups: GROUPS, list: LIST, syntax: SYNTAX };

    /** 按当前语言取字段 */
    PetVars.text = function (item, field, lang) {
        var en = lang === 'en';
        if (field === 'ex') return en ? (item.exEn || item.ex) : item.ex;
        if (field === 'src') return en ? (item.srcEn || item.src) : item.src;
        if (field === 'empty') return item.empty ? (en ? item.empty.en : item.empty.zh) : '';
        return en ? (item[field + 'En'] || item[field]) : item[field];
    };
})();
