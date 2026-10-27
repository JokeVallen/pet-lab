/*!
 * actions 模块 —— 动作端口
 *
 * 对外只认"意图"，不认具体动画名：
 *   intent.state  { state }        切换长时间状态（idle / reading / sleepy）
 *   intent.action { act, level }   一次性动作
 *   intent.hold / intent.release   持续状态（拖拽）
 *
 * 真正的播放在宿主里（当前仍由宠物本体的 director 承担），
 * 这层负责：意图 → 端口调用 + 忙状态上报。等播放器搬迁完成后，
 * 宿主注入的实现会换成 modules/player.js。
 */


    function createActionsModule(host) {
        // host: { play(act), hold(act), release(act), setState(state), isBusy() }
        var mounted = false;

        return {
            id: 'actions',
            provides: ['action.play', 'action.hold', 'action.state'],
            mount: function (ctx) {
                this._ctx = ctx;
                mounted = true;

                ctx.on('intent.action', function (e) {
                    if (!e || !e.act) return;
                    var ok = ctx.action({
                        act: e.act,
                        level: e.level || 'scheduled',
                        duration: e.duration || 0
                    });
                    if (!ok) return;
                    try { host.play(e.act); } catch (err) { /* ignore */ }
                });

                ctx.on('intent.state', function (e) {
                    if (!e || !e.state) return;
                    try { host.setState(e.state); } catch (err) { /* ignore */ }
                });

                ctx.on('intent.hold', function (e) {
                    if (!e || !e.act) return;
                    if (!ctx.hold({ act: e.act })) return;
                    try { host.hold(e.act); } catch (err) { /* ignore */ }
                });

                ctx.on('intent.release', function (e) {
                    if (!ctx.release({ act: e && e.act })) return;
                    try { host.release(e && e.act); } catch (err) { /* ignore */ }
                });
            },
            unmount: function () {
                mounted = false;
            },
            isMounted: function () { return mounted; }
        };
    }

    export const PetActions = { createActionsModule: createActionsModule };
