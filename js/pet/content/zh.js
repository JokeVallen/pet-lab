/*!
 * content/zh.js —— 中文文案
 *
 * 这里只放"给访客看的字"：台词、回答、提示。代码里不再出现具体句子。
 * 想换角色/换语言，复制一份 xx.js 改内容即可，JS 不用动。
 * 模板变量用 {name} 形式，由 PetContent.t(key, vars) 替换。
 */
export default {
    meta: {
        code: 'zh',
        label: '中文',
        petFallback: '宠物'
    },

    mood: {
        sleeping: '打盹中',
        starving: '饿扁了',
        loved: '超喜欢你',
        happy: '很开心',
        peckish: '有点饿',
        curious: '好奇'
    },

    ui: {
        chatAria: '和{name}聊天',
        chatPlaceholder: '和{name}说点什么…',
        chatClose: '关闭对话',
        inputAria: '输入消息',
        send: '发送',
        feed: '投喂',
        chat: '聊天',
        hide: '隐藏{name}',
        pet: '摸摸{name}',
        restore: '召回{name}',
        credit: '动画素材 <a href="https://github.com/PC2005-cloud/dsh-pet" target="_blank" rel="noopener nofollow">dsh-pet</a> · 角色 <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh" target="_blank" rel="noopener nofollow">CC BY-NC-SA 4.0</a>'
    },

    /* persona 里没配时的兜底台词（配置优先） */
    persona: {
        about: '点我、拖我，或者随便和我聊聊～',
        again: '又见面了。',
        firstMeet: '第一次见？',
        streak7: '你来第 {n} 天啦。',
        streak3: '又见面了，第 {n} 天。',
        greet: '你好呀。',
        asleep: '……睡着了。',
        fed: '谢谢！',
        back: '我回来啦。'
    },

    chat: {
        empty: '你想说什么呀？',
        fallback: [
            '这个问题值得写一张知识卡片。',
            '要不要去求职模拟抽一组题？',
            '今天也别忘了给算法库安排一次复习。',
            '慢慢来，先把一个问题讲清楚。',
            '我在这里，你写你的，我不吵你。',
            '唔……这个我还没学会，等我长大一点再回答你。'
        ],
        replies: [
            { id: 'greet', match: '你好|您好|hi|hello|在吗|嗨', flags: 'i', lines: ['在的！今天也一起写点东西吧。', '嗨～我一直在这儿。'] },
            { id: 'knowledge', match: '知识|卡片|笔记', lines: ['知识库把零散的问题沉淀成卡片了，去 /knowledge/ 翻翻看？', '想记点什么的话，知识库很适合做长期复习。'] },
            { id: 'algorithm', match: '算法|刷题|leetcode|题解', flags: 'i', lines: ['算法库里有间隔复习，先写模板再刷题会快很多：/algorithm/'] },
            { id: 'mock', match: '面试|笔试|模拟|求职', lines: ['求职模拟可以随机抽题练表达：/mock/，别只背答案哦。'] },
            { id: 'tools', match: '工具|效率', lines: ['实用工具里有些小玩意，写博客的时候挺顺手的：/tools/'] },
            { id: 'games', match: '游戏|摸鱼|玩', lines: ['个人游戏区有几只小游戏，写累了可以去摸鱼：/games/'] },
            { id: 'questions', match: '题库|unity|c#|csharp', flags: 'i', lines: ['Unity 题库按知识点整理过，可以按标签挑着看：/questions/'] },
            { id: 'blog', match: '博客|文章|首页|归档', lines: ['首页就是归档，慢慢翻吧，都是些记录和思考。'] },
            { id: 'hungry', match: '饿|吃|鱼|投喂|喂', lines: ['想吃白米饭……点一下 🍚 就能喂我。', '肚子在叫了，有米饭吗？'] },
            { id: 'tired', match: '累|难过|焦虑|压力|烦', lines: ['先休息五分钟吧。写不完的代码不会跑掉，但你会的。', '要不要先站起来走两步？我在这儿等你。'] },
            { id: 'praise', match: '谢谢|喜欢|可爱|爱你|棒', lines: ['嘿嘿，被夸到了。好感度 +1！', '被你这么说，尾巴都翘起来了。'] },
            { id: 'who', match: '你是谁|你叫什么|什么鲸鱼|deepseek', flags: 'i', lines: ['我是博客里的鲸鱼娘大肥鱼，不是官方产品哦，只是一只住在网页角落里的小鲸鱼。'] },
            { id: 'night', match: '晚安|睡觉|困', lines: ['晚安，早点休息。我会在角落里打盹。'] },
            { id: 'rice', match: '米饭|饭|饿|吃', lines: ['白米饭才是正经饭，点 🍚 喂我。', '一碗就够了……好吧，两碗。'] },
            { id: 'drag', match: '拖|抓|拎', lines: ['别拎我尾巴！', '被抓起来的时候我会缩一下，正常的。'] },
            { id: 'head', match: '摸头|脑袋|头', lines: ['摸头可以，戳就不行。', '头顶的发饰是限量款。'] },
            { id: 'theme', match: '暗色|夜间|晚上|开灯|主题', lines: ['开暗色我就当是晚上了。', '白天模式我会精神一点。'] },
            { id: 'bored', match: '无聊|没事|陪你', lines: ['那就陪我看会儿代码吧。', '无聊的话，去算法库随便点一道？'] },
            { id: 'bug', match: 'bug|报错|崩|错误', flags: 'i', lines: ['报错总能解决的，先看第一行日志。', '把复现步骤写下来，问题就小一半。'] },
            { id: 'cheer', match: '加油|努力|坚持', lines: ['一起加油，慢慢来。', '每天一点就够，别把自己逼太紧。'] },
            { id: 'morning', match: '早|早安', lines: ['早安！今天想先解决哪一件事？'] },
            { id: 'stuck', match: '厉害|难|不会|学不动', lines: ['不会才正常，会了就不用学了。挑最小的一步先做。'] }
        ]
    },

    /* 点击分区的默认反应（配置里的 zoneReactions 优先） */
    zone: {
        head: ['别戳脑袋啦。', '脑袋不能乱摸……'],
        crown: ['头上有东西吗？'],
        cheek: ['痒。', '别捏脸。'],
        face: ['……'],
        body: ['干嘛呀。'],
        fin: ['鳍不能拽。'],
        belly: ['肚子软软的。', '别戳肚子啦。'],
        tail: ['尾巴会痒的。', '甩你一脸水。']
    },

    /* 站点信息：问"你能做什么""这页有什么"时的回答 */
    site: {
        ability: '能陪你读文章、记住你来了几天，也会被戳、被拖、被喂。问路也行：算法库 /algorithm/、题库 /questions/、工具 /tools/。',
        postInfo: '这篇属于「{tag}」{mins}。正文我也看不懂，你自己读吧。',
        postMins: '，大概 {n} 分钟能读完',
        postNoTag: '没打标签',
        clock: '现在 {h} 点 {m} 分。',
        clockLate: '该睡了。',
        tagCount: '这页有 {n} 个标签：{list}。',
        tagNone: '这页没标签，标签总览在 /tags/。',
        streak: '这是你连续来的第 {n} 天，我记着呢。',
        /* 问句的特征词也要按语言来，否则换成英文只会回落到通用句库 */
        patterns: {
            ability: '能做什么|会什么|功能|你能干|会干|帮我做|有什么用',
            postInfo: '这篇|讲的什么|说什么|内容',
            clock: '几点|现在时间|几号|星期几',
            tags: '几个标签|多少标签|什么标签',
            streak: '多久|来了几天|第几天'
        }
    },

    /* 被动触发的旁白 */
    ambient: {
        themeDark: ['天黑了呢，我把音量调小一点。', '夜里安静，适合慢慢写。', '开暗色了……那我也有点困了。'],
        themeLight: ['开灯啦，精神一点！', '白天模式，冲！', '亮起来就清醒了。'],
        copy: '抄走也没关系，反正我也不会写回去。',
        readEnd: '读到底了，辛苦了。',
        backTop: ['回到开头了，要再读一遍吗？', '又回到上面了。'],
        tagPage: '在翻「{name}」相关的内容呀。'
    },

    /* 站内检索 */
    search: {
        pending: '让我翻一下索引……',
        notFound: '没找到相关的内容，换个词试试？',
        kindCard: '卡片',
        kindPage: '页面',
        kindPost: '文章',
        kindQuestion: '题目',
        kindPaper: '试卷',
        kindKnowledge: '知识卡',
        kindAlgorithm: '算法',
        unavailable: '这一页没接上站点的检索接口，我先没法翻库。',
        closest: '最接近的是{kind}「{title}」{more}：{url}',
        listHead: '最接近的是{kind}「{title}」：{url}',
        andMore: '，另外还有 {n} 条',
        listItem: '· 「{title}」{url}',
        listMore: '……还有 {n} 条',
        stopwords: ['有没有', '有没', '没有', '关于', '相关', '相关的', '文章', '卡片', '知识', '一下', '帮我', '找找', '看看', '什么', '哪些', '这个', '那个', '的', '了', '吗', '呢', '和', '与'],
        intent: '有没有|找一下|帮我找|搜一[下搜]|查一下|关于|相关的|哪篇|哪张|哪些文章|站内'
    },

    /* 站点上下文规则（adapter 里那批） */
    adapter: {
        unity: '这篇和 Unity 有关……题库里有对应的知识点。',
        algorithm: '算法文！要不要顺便去复习一道？',
        finished: ['读完了呀，辛苦了。', '看到底了，有收获吗？'],
        long: ['这篇够看一阵的，慢慢读。', '长文，我先趴着陪你。'],
        short: ['很短的一篇，一下就看完了吧。', '这种长度刚好，一口气读完。'],
        noComment: '还没人说话……我可以先当第一个。',
        hot: '这么热闹，看来这篇戳到大家了。',
        late: '这么晚还在首页翻……早点睡吧。',
        streak: '又见面了，第 {n} 天。',
        backTop: ['回到开头了，要再读一遍吗？', '又回到上面了。'],
        tag: ['「{name}」这个标签下的东西不少。', '在翻「{name}」相关的内容呀。'],
        notFound: ['这里什么都没有……你是不是点错链接了？', '迷路了？首页在这边。'],
        keywords: {
            unity: ['unity', 'c#', 'csharp'],
            algorithm: ['算法', 'leetcode', '数据结构']
        }
    }
};
