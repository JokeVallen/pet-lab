/*!
 * content/en.js —— English copy
 *
 * Mirrors the shape of zh.js key for key. Missing keys fall back to zh.js,
 * so a locale can start small and grow.
 */
export default {
    meta: {
        code: 'en',
        label: 'English',
        petFallback: 'pet'
    },

    mood: {
        sleeping: 'napping',
        starving: 'starving',
        loved: 'adores you',
        happy: 'happy',
        peckish: 'a bit hungry',
        curious: 'curious'
    },

    ui: {
        chatAria: 'Chat with {name}',
        chatPlaceholder: 'Say something to {name}…',
        chatClose: 'Close chat',
        inputAria: 'Message',
        send: 'Send',
        feed: 'Feed',
        chat: 'Chat',
        hide: 'Hide {name}',
        pet: 'Pet {name}',
        restore: 'Bring back {name}',
        credit: 'Art from <a href="https://github.com/PC2005-cloud/dsh-pet" target="_blank" rel="noopener nofollow">dsh-pet</a> · character under <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener nofollow">CC BY-NC-SA 4.0</a>'
    },

    persona: {
        about: 'Poke me, drag me, or just say hi.',
        again: 'You again.',
        firstMeet: 'First time here?',
        streak7: 'Day {n} in a row already.',
        streak3: 'Back again — day {n}.',
        greet: 'Hello there.',
        asleep: '…fast asleep.',
        fed: 'Thank you!',
        back: 'I am back.'
    },

    chat: {
        empty: 'What is it?',
        fallback: [
            'That one deserves a knowledge card.',
            'Want a random interview question to practise?',
            'Do not forget your algorithm review today.',
            'Slow down: make one question clear first.',
            'I am here. Write, I will keep quiet.',
            'Hmm, I have not learned that yet. Ask me again when I grow up.'
        ],
        replies: [
            { id: 'greet', match: 'hi|hello|hey|good morning|good evening', flags: 'i', lines: ['Here! Let us write something today.', 'Hey — I never left.'] },
            { id: 'knowledge', match: 'knowledge|card|note', flags: 'i', lines: ['The knowledge base turns loose questions into cards. Try /knowledge/.', 'If you want to remember something, cards beat re-reading.'] },
            { id: 'algorithm', match: 'algorithm|leetcode|practice|solution', flags: 'i', lines: ['The algorithm base has spaced review. Templates first, then problems: /algorithm/'] },
            { id: 'mock', match: 'interview|mock|job|career', flags: 'i', lines: ['Mock interviews draw random questions so you can practise out loud: /mock/'] },
            { id: 'tools', match: 'tool|utility|efficient', flags: 'i', lines: ['There are some handy bits under /tools/ when you are writing.'] },
            { id: 'games', match: 'game|break|play', flags: 'i', lines: ['A few small games live in /games/ for when your brain needs a pause.'] },
            { id: 'questions', match: 'question|unity|c#|csharp', flags: 'i', lines: ['The Unity question bank is sorted by topic — browse it by tag: /questions/'] },
            { id: 'blog', match: 'blog|post|article|archive|home', flags: 'i', lines: ['The home page is the archive. Take your time, it is all notes and thinking.'] },
            { id: 'hungry', match: 'hungry|eat|food|feed|fish', flags: 'i', lines: ['I want white rice… tap the 🍚 button to feed me.', 'My stomach is rumbling. Any rice around?'] },
            { id: 'tired', match: 'tired|sad|anxious|stress|upset', flags: 'i', lines: ['Take five minutes. Unfinished code waits; you should not.', 'Stand up and walk a bit? I will wait here.'] },
            { id: 'praise', match: 'thanks|like you|cute|love you|great', flags: 'i', lines: ['Hehe, I will take that. Affection +1!', 'Say that again and my tail curls up.'] },
            { id: 'who', match: 'who are you|your name|deepseek', flags: 'i', lines: ['I am the whale girl living in this blog — not an official product, just a small whale in the corner of a page.'] },
            { id: 'night', match: 'good night|sleep|sleepy', flags: 'i', lines: ['Good night. I will doze in the corner.'] },
            { id: 'rice', match: 'rice|meal|dinner', flags: 'i', lines: ['White rice is the proper meal. Tap 🍚 and feed me.', 'One bowl is enough… fine, two.'] },
            { id: 'drag', match: 'drag|grab|pick me', flags: 'i', lines: ['Not the tail!', 'I flinch when lifted. That is normal.'] },
            { id: 'head', match: 'head|pat|hair', flags: 'i', lines: ['Patting is fine, poking is not.', 'The hair ornament is limited edition.'] },
            { id: 'theme', match: 'dark|night mode|light|theme', flags: 'i', lines: ['Dark mode means it is night for me too.', 'Light mode wakes me right up.'] },
            { id: 'bored', match: 'bored|nothing to do|company', flags: 'i', lines: ['Then sit with me and the code for a while.', 'Bored? Open a random problem in the algorithm base.'] },
            { id: 'bug', match: 'bug|error|crash|exception', flags: 'i', lines: ['Errors always get solved. Read the first line of the log.', 'Write down the repro steps and the problem halves.'] },
            { id: 'cheer', match: 'keep going|try harder|persist', flags: 'i', lines: ['We go slowly, together.', 'A little each day is enough. Do not squeeze yourself dry.'] },
            { id: 'morning', match: 'morning|good morning', flags: 'i', lines: ['Morning! What is the first thing today?'] },
            { id: 'stuck', match: 'hard|difficult|stuck|cannot', flags: 'i', lines: ['Not knowing is normal — otherwise there would be nothing to learn. Take the smallest step.'] }
        ]
    },

    zone: {
        head: ['Stop poking my head.', 'You cannot just rub a head like that…'],
        crown: ['Is there something on my head?'],
        cheek: ['That tickles.', 'Do not pinch my face.'],
        face: ['…'],
        body: ['What are you doing?'],
        fin: ['Mind the fin.'],
        belly: ['Soft, right?', 'Stop poking my belly.'],
        tail: ['My tail is ticklish.', 'I will splash you.']
    },

    site: {
        ability: 'I read along with you, remember how many days you have visited, and I can be poked, dragged and fed. I can give directions too: /algorithm/, /questions/, /tools/.',
        postInfo: 'This one is filed under "{tag}"{mins}. I cannot read the body either — you are on your own.',
        postMins: ', about {n} min to read',
        postNoTag: 'no tags',
        clock: 'It is {h}:{m} now.',
        clockLate: ' You should sleep.',
        tagCount: 'This page has {n} tags: {list}.',
        tagNone: 'No tags on this page. The overview lives at /tags/.',
        streak: 'That is {n} days in a row. I am counting.',
        patterns: {
            ability: 'what can you do|what do you do|your features|help me with',
            postInfo: 'this post|what is this|what is it about|this article',
            clock: 'what time|the time now|what day',
            tags: 'how many tags|what tags|which tags',
            streak: 'how long|how many days|which day'
        }
    },

    ambient: {
        themeDark: ['It got dark — I will keep my voice down.', 'Quiet hours. Good for slow writing.', 'Dark mode… now I am sleepy too.'],
        themeLight: ['Lights on — wide awake!', 'Day mode, let us go!', 'Bright again, and so am I.'],
        copy: 'Copy away. I will not write it back.',
        readEnd: 'You reached the end. Good work.',
        backTop: ['Back at the top — reading it again?', 'Up we go again.'],
        tagPage: 'Browsing things tagged "{name}", are we?'
    },

    search: {
        pending: 'Let me check the index…',
        notFound: 'Nothing matched. Try another word?',
        kindCard: 'card',
        kindPage: 'page',
        kindPost: 'post',
        kindQuestion: 'question',
        kindPaper: 'paper',
        kindKnowledge: 'knowledge card',
        kindAlgorithm: 'algorithm',
        unavailable: 'This page has no site search hookup, so I cannot look anything up here.',
        closest: 'Closest {kind}: "{title}"{more} — {url}',
        listHead: 'Closest {kind}: "{title}" — {url}',
        andMore: ', and {n} more',
        listItem: '· "{title}" {url}',
        listMore: '…and {n} more',
        stopwords: ['a', 'an', 'the', 'is', 'are', 'of', 'about', 'any', 'some', 'please', 'find', 'search', 'for', 'me', 'post', 'posts', 'article', 'articles', 'card', 'cards', 'page', 'pages', 'do', 'you', 'have'],
        intent: 'do you have|find|search|look up|any (post|article|card|page)s? about'
    },

    adapter: {
        unity: 'This one is about Unity… the question bank has matching topics.',
        algorithm: 'An algorithm post! Fancy a review problem afterwards?',
        finished: ['You finished it. Nice.', 'All the way down — did it land?'],
        long: ['This is a long one. Take it slowly.', 'Long read. I will lie here with you.'],
        short: ['A short one — gone in a minute.', 'Nice length, read in one go.'],
        noComment: 'Nobody has spoken yet… I can be first.',
        hot: 'Busy thread. This one clearly landed.',
        late: 'Still browsing the home page this late… go to bed.',
        streak: 'Back again — day {n}.',
        backTop: ['Back at the top — reading it again?', 'Up we go again.'],
        tag: ['Quite a lot under "{name}".', 'Browsing "{name}", are we?'],
        notFound: ['Nothing here… wrong link?', 'Lost? The home page is this way.'],
        keywords: {
            unity: ['unity', 'c#', 'csharp'],
            algorithm: ['algorithm', 'leetcode', 'data structure']
        }
    }
};
