/* generated from config/pet.yaml by tools/build-config.js -- do not edit */
export default {
    "name": "大肥鱼",
    "storageKey": "deepseek-pet-v4",
    "animDir": "/images/pet/anim/",
    "image": "/images/pet/anim/poster.webp",
    "shadow": {
        "offsetX": 7,
        "offsetY": 12,
        "blur": 10,
        "color": "rgba(33, 72, 145, 0.16)"
    },
    "idleRollMs": [
        9000,
        21000
    ],
    "idleSleepMs": 150000,
    "drag": {
        "enabled": true,
        "thresholdPx": 6
    },
    "click": {
        "particleCount": 3
    },
    "ui": {
        "actionHideDelayMs": 320,
        "actionFadeMs": 140
    },
    "speech": {
        "dedupeMs": 8000,
        "maxQueue": 8,
        "bubbleTtl": 3600,
        "contextTtl": 4200
    },
    "chat": {
        "maxMessages": 10
    },
    "rules": {
        "defaultCooldown": 25,
        "items": [
            {
                "id": "post.unity",
                "when": {
                    "page": "post",
                    "tagsAny": [
                        "unity",
                        "c#",
                        "csharp"
                    ]
                },
                "say": "这篇和 Unity 有关……题库里有对应的知识点。"
            },
            {
                "id": "post.algorithm",
                "when": {
                    "page": "post",
                    "tagsAny": [
                        "算法",
                        "leetcode",
                        "数据结构"
                    ]
                },
                "say": "算法文！要不要顺便去复习一道？"
            },
            {
                "id": "post.finished",
                "when": {
                    "page": "post",
                    "scrollGt": 0.85
                },
                "say": [
                    "读完了呀，辛苦了。",
                    "看到底了，有收获吗？"
                ],
                "act": "look"
            },
            {
                "id": "post.long",
                "when": {
                    "page": "post",
                    "wordsGt": 4000
                },
                "say": [
                    "这篇够看一阵的，慢慢读。",
                    "长文，我先趴着陪你。"
                ],
                "act": [
                    "think",
                    "doze"
                ]
            },
            {
                "id": "post.short",
                "when": {
                    "page": "post",
                    "wordsLt": 600
                },
                "say": [
                    "很短的一篇，一下就看完了吧。",
                    "这种长度刚好，一口气读完。"
                ],
                "act": "look"
            },
            {
                "id": "post.noComment",
                "when": {
                    "page": "post",
                    "commentsEq": 0,
                    "scrollGt": 0.5
                },
                "say": "还没人说话……我可以先当第一个。"
            },
            {
                "id": "post.hot",
                "when": {
                    "page": "post",
                    "commentsGte": 3
                },
                "say": "这么热闹，看来这篇戳到大家了。",
                "act": "hum"
            },
            {
                "id": "home.late",
                "when": {
                    "page": "home",
                    "dark": true,
                    "hourGte": 23
                },
                "say": "这么晚还在首页翻……早点睡吧。",
                "act": "doze"
            },
            {
                "id": "home.streak",
                "when": {
                    "page": "home",
                    "streakGte": 3
                },
                "say": "又见面了，第 {streak} 天。"
            },
            {
                "id": "post.backToTop",
                "when": {
                    "page": "post",
                    "lastScrollGt": 0.8,
                    "scrollLt": 0.25
                },
                "say": [
                    "回到开头了，要再读一遍吗？",
                    "又回到上面了。"
                ],
                "act": "stretch"
            },
            {
                "id": "page.tag",
                "when": {
                    "type": "tag"
                },
                "say": [
                    "「{tag}」这个标签下的东西不少。",
                    "在翻「{tag}」相关的内容呀。"
                ],
                "act": "hum"
            },
            {
                "id": "page.404",
                "when": {
                    "type": "404"
                },
                "say": [
                    "这里什么都没有……你是不是点错链接了？",
                    "迷路了？首页在这边。"
                ],
                "act": [
                    "puzzle",
                    "angry"
                ]
            }
        ]
    },
    "search": {
        "url": "/pet-index.json",
        "preloadDelayMs": 5000,
        "maxResults": 3
    },
    "animations": {
        "idle": [
            "idle"
        ],
        "clicks": [
            "click-happy",
            "click-shy",
            "click-wave"
        ],
        "drag": "drag",
        "events": {
            "sleep": "sleep",
            "eat": "eat"
        }
    },
    "zones": [
        {
            "id": "head",
            "yMin": 0,
            "yMax": 0.42
        },
        {
            "id": "head.crown",
            "yMin": 0,
            "yMax": 0.14,
            "parent": "head"
        },
        {
            "id": "head.cheek",
            "yMin": 0.14,
            "yMax": 0.3,
            "parent": "head"
        },
        {
            "id": "head.face",
            "yMin": 0.3,
            "yMax": 0.42,
            "parent": "head"
        },
        {
            "id": "body",
            "yMin": 0.42,
            "yMax": 0.86
        },
        {
            "id": "body.fin",
            "yMin": 0.55,
            "yMax": 0.74,
            "xMin": 0,
            "xMax": 0.35,
            "parent": "body"
        },
        {
            "id": "body.belly",
            "yMin": 0.6,
            "yMax": 0.86,
            "xMin": 0.35,
            "xMax": 0.7,
            "parent": "body"
        },
        {
            "id": "tail",
            "yMin": 0.86,
            "yMax": 1
        }
    ],
    "zoneReactions": {
        "head": {
            "act": "click-shy",
            "say": [
                "别戳脑袋啦。",
                "脑袋不能乱摸……"
            ]
        },
        "head.crown": {
            "act": "click-wave",
            "say": [
                "头上有东西吗？"
            ]
        },
        "head.cheek": {
            "act": "click-shy",
            "say": [
                {
                    "t": "痒。",
                    "w": 2
                },
                {
                    "t": "别捏脸。"
                }
            ]
        },
        "head.face": {
            "act": "click-shy"
        },
        "body": {
            "act": "click-happy",
            "say": [
                "干嘛呀。"
            ]
        },
        "body.fin": {
            "act": "spin",
            "say": [
                "鳍不能拽。"
            ]
        },
        "body.belly": {
            "act": "click-happy",
            "say": [
                {
                    "t": "肚子软软的。",
                    "w": 2
                },
                {
                    "t": "别戳肚子啦。"
                }
            ]
        },
        "tail": {
            "act": "tail",
            "say": [
                {
                    "t": "尾巴会痒的。",
                    "w": 2
                },
                {
                    "t": "甩你一脸水。"
                }
            ]
        }
    },
    "states": {
        "idle": {
            "clip": "idle",
            "pool": [
                "look",
                "hum",
                "tail",
                "bubbles",
                "stretch",
                "cheerful",
                "magic",
                "puzzle"
            ]
        },
        "sleepy": {
            "clip": "sleep",
            "pool": [
                "yawn",
                "doze",
                "look",
                "sad"
            ]
        },
        "busy": {
            "clip": "idle",
            "pool": [
                "hum",
                "look",
                "doze",
                "think",
                "code"
            ]
        }
    },
    "policy": {
        "rollWeights": {
            "idle": 10,
            "turn": 0,
            "move": 0
        },
        "stateRules": [
            {
                "when": {
                    "hourBelow": 6
                },
                "state": "sleepy"
            },
            {
                "when": {
                    "dark": true,
                    "hourFrom": 22
                },
                "state": "sleepy"
            },
            {
                "when": {
                    "page": "post",
                    "scrollFrom": 0.12,
                    "scrollTo": 0.92
                },
                "state": "busy"
            }
        ],
        "calendar": {
            "1-1": {
                "act": "fireworks",
                "line": "新年快乐！今年也一起写下去吧。"
            },
            "2-14": {
                "act": "bow",
                "line": "今天……要不要多陪我一会儿？"
            },
            "3-8": {
                "act": "cheerful",
                "line": "节日快乐！今天可以少写点代码。"
            },
            "5-1": {
                "act": "stretch",
                "line": "劳动节，但你还是打开博客了。"
            },
            "6-1": {
                "act": "bubbles",
                "line": "儿童节！我可以多要一碗米饭吗？"
            },
            "10-1": {
                "act": "fireworks",
                "line": "假期快乐，出去走走也不错。"
            },
            "12-24": {
                "act": "click-wave",
                "line": "平安夜，角落里也有点热闹。"
            },
            "12-25": {
                "act": "cheerful",
                "line": "圣诞快乐！有我的礼物吗？"
            },
            "12-31": {
                "act": "hum",
                "line": "今年最后一天了，辛苦啦。"
            }
        }
    },
    "clipExt": "webm",
    "hostId": "deepseek-pet",
    "size": {
        "width": 200,
        "height": 177
    },
    "accent": {
        "primary": "#4a8cf7",
        "primary2": "#7c5cf0",
        "cyan": "#62d9f5"
    },
    "persona": {
        "name": "大肥鱼",
        "alt": "鲸鱼娘大肥鱼",
        "icons": {
            "feed": "🍚",
            "restore": "🐳"
        },
        "about": "我是大肥鱼，一只住在博客里的鲸鱼娘。点我、拖我、喂我白米饭，或者随便和我聊聊～",
        "sleep": "……（大肥鱼靠着鲸鱼尾巴睡着了）",
        "feed": [
            "谢谢！白米饭最香了。",
            "呜哇，是热腾腾的米饭！好感度上升。",
            "吃饱了才有力量陪你写代码。"
        ],
        "greet": {
            "late": [
                "这么晚还在写代码？要注意休息呀。",
                "夜深了，我陪你把这最后一点写完。"
            ],
            "morning": [
                "早上好，今天先解决最重要的一件事。",
                "早安，要不要去算法库复习一道？"
            ],
            "afternoon": [
                "下午好，写累了吗？摸摸鱼吧。",
                "今天也一起把问题拆小一点。"
            ],
            "evening": [
                "晚上好，今天辛苦了。",
                "晚上适合复盘，把今天的卡点记下来吧。"
            ]
        },
        "firstMeet": "第一次见？我是大肥鱼，住在这个角落里。",
        "again": "又见面了。",
        "streak3": "又见面了，第 {n} 天。",
        "streak7": "你来第 {n} 天啦，我已经认得你了。"
    }
};
