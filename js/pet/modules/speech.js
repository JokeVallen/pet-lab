/*!
 * speech 模块 —— 语言通道
 *
 * 生产者只发 speech.act：{ text, channel, priority, ttl }
 * 本模块负责排队、去重、按优先级投递到具体渲染器（气泡 / 对话框）。
 * 它不产生任何文本，也不知道文本从哪来。
 */


    // 数字越大越优先
    var PRIORITY = { ambient: 1, context: 2, reply: 3 };

    function createSpeechModule(opts) {
        var renderBubble = opts.renderBubble;
        var renderDialog = opts.renderDialog;

        var queue = [];
        var lastText = '';
        var lastAt = 0;
        var flushing = false;

        function pickChannel(act) {
            if (act.channel && act.channel !== 'auto') return act.channel;
            // 对话界面打开时优先走对话框，否则冒气泡
            return opts.isDialogOpen && opts.isDialogOpen() ? 'dialog' : 'bubble';
        }

        function dispatch(act) {
            var channel = pickChannel(act);
            if (channel === 'dialog' && renderDialog) {
                renderDialog(act.text);
            } else if (renderBubble) {
                renderBubble(act.text, act.ttl || 3600);
            }
            return channel;
        }

        function flush() {
            if (flushing) return;
            flushing = true;
            try {
                while (queue.length) {
                    var act = queue.shift();
                    dispatch(act);
                }
            } finally {
                flushing = false;
            }
        }

        function enqueue(act, kernel) {
            if (!act || !act.text) return false;
            var text = String(act.text);

            // 同句不连说（默认 8 秒内）
            var now = Date.now();
            if (text === lastText && now - lastAt < (opts.dedupeMs || 8000)) {
                kernel && kernel.emit('speech.dropped', { text: text, reason: 'duplicate' });
                return false;
            }

            var p = PRIORITY[act.priority || 'context'] || PRIORITY.context;

            // 新来的比队首更紧急 → 插队；否则排到队尾
            var insertAt = queue.length;
            for (var i = 0; i < queue.length; i++) {
                if ((queue[i]._p || 0) < p) {
                    insertAt = i;
                    break;
                }
            }
            act._p = p;
            queue.splice(insertAt, 0, act);

            // 队列上限，防止事件风暴
            if (queue.length > (opts.maxQueue || 8)) queue.length = opts.maxQueue || 8;

            lastText = text;
            lastAt = now;
            flush();
            return true;
        }

        return {
            id: 'speech',
            provides: ['speech.bubble', 'speech.dialog'],
            mount: function (ctx) {
                this._ctx = ctx;
                ctx.on('speech.act', function (act) { enqueue(act, ctx); });
            },
            unmount: function () {
                queue.length = 0;
            },
            // 供测试与外部调用
            _enqueue: enqueue,
            _queueSize: function () { return queue.length; }
        };
    }

    export const PetSpeech = { createSpeechModule: createSpeechModule, PRIORITY: PRIORITY };
