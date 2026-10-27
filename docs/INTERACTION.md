# 交互协议（设计稿）

> 宠物怎么被授权做事，用户怎么对宠物说话。
> **状态：草案，未实现。** 目标版本：下一个大版本。
> 现状见 [STATUS.md](STATUS.md)；本文只描述计划。

---

## 1. 范围

| 方向 | 内容 | 本文是否覆盖 |
| --- | --- | --- |
| 宠物 → 站点 | 申请执行一个被授权的动作 | ✅ |
| 站点 → 宠物 | 下发一条指令（说什么、演什么） | ✅ 仅约定 |
| 用户 → 宠物 | 文字 / 语音输入 | ✅ |
| 模型接入、账号体系 | — | ❌ 不在本文 |

---

## 2. 四条原则

1. **宠物不获得超过「一次点击」的权力。** 它只能操作页面上真实存在、可见、可用的元素。
2. **站点声明能力，用户逐次确认，默认拒绝。**
3. **URL 不由宠物提供。** 宠物给语义目标，地址从真实 DOM 元素里读。
4. **没有配置时行为不变。** 未声明 `actions` 就退回今天的「把链接打在气泡里」。

---

## 3. 能力声明（站点侧）

写在 `config/pet.yaml` 新增的 `actions` 段：

```yaml
actions:
  version: 1
  defaultConsent: ask          # ask | always | never
  items:
    - id: open-post
      label: 打开文章
      selector: 'a[data-pet-target="post"]'
      resolve: href            # href | data | click
      sideEffect: false
      consent: ask
      cooldownMs: 4000

    - id: open-search
      label: 打开搜索
      selector: '#search-button'
      resolve: click
      sideEffect: false
      consent: always          # 只读且低风险，可免确认
```

| 字段 | 含义 |
| --- | --- |
| `id` | 能力标识，规则和台词里引用它 |
| `label` | 给用户看的名字，出现在确认气泡里（用站点自己的语言） |
| `selector` | 指向站点自己的 UI 元素 |
| `resolve` | `href` 取地址、`data` 取 `data-pet-url`、`click` 直接点 |
| `sideEffect` | 有副作用（提交、删除）时必须为 `true` |
| `consent` | `ask` / `always` / `never`，`sideEffect` 时强制 `ask` |
| `cooldownMs` | 同一能力的冷却，防止连点 |

**执行前三重校验**（缺一不可）：

1. 元素存在且 `offsetParent !== null`（可见）
2. 元素未 `disabled`、未 `aria-disabled`
3. `resolve: href` 时，解析出的地址必须与 `location.origin` 同源

**PJAX / 换页**：页面切换后旧元素失效。适配器在 `pjax:complete` 与 `popstate` 时重新解析，
解析结果不跨页缓存；切换后找不到元素就按「找不到」处理。

---

## 4. 请求协议

### 4.1 事件

| 事件 | 载荷 | 说明 |
| --- | --- | --- |
| `action.request` | `{ requestId, id, args, level }` | 宠物提出申请 |
| `action.confirm` | `{ requestId, id, label }` | 需要用户点确认 |
| `action.grant` | `{ requestId, scope }` | 用户点了「允许」，`scope` 为 `once`/`session`/`always` |
| `action.deny` | `{ requestId, reason }` | 用户拒绝或校验失败 |
| `action.done` | `{ requestId, ok, error }` | 执行结果 |
| `action.revoke` | `{ id, scope }` | 撤销已授予的权限 |

### 4.2 时序

```
规则命中
  → 宠物 emit action.request { id:'open-post', args:{ target:'文章：xxx' } }
  → 适配器解析目标 → 找到元素 → 校验
       ├─ 失败 → emit action.deny { reason:'not-found' } → 宠物说「没找到」
       └─ 通过 → emit action.confirm
  → 用户点「带我去」 → emit action.grant { scope:'once' }
  → 适配器执行 → emit action.done { ok:true }
  → 宠物说「过去啦」
```

### 4.3 约束

- 同一时刻只允许 **一个** pending 请求，新的覆盖旧的（旧的按 `deny: superseded` 结束）。
- `ambient` 级别的请求**只提示不执行**，必须由用户或规则升级到 `direct`。
- `hold` 级别保留给拖拽，不参与本协议。
- 所有请求、拒绝、执行都进环形日志（200 条）。

---

## 5. 用户授权

| 级别 | 存储 | 有效期 | 可撤销 |
| --- | --- | --- | --- |
| `once` | 不存 | 单次 | — |
| `session` | 内存 | 当前标签页 | 刷新即失效 |
| `always` | `localStorage: pet-consent` | 长期 | 设置面板可清空 |

补充规则：

- `sideEffect: true` 的能力**不允许** `always`，每次都要确认。
- 站点可设 `defaultConsent: never`，此时只能 `ask` 一个都记不住（合规场景）。
- 拒绝后同一会话内不再追问同一个能力。

---

## 6. 输入通道

### 6.1 契约

```js
PetInput.registerProvider('voice', {
    available: () => Promise<boolean>,
    start:     (opts) => Promise<{ text, confidence, lang }>,
    cancel:    () => void
});
```

内置 `text` provider（聊天框），`voice` 由站点或默认实现提供。宠物只调契约，不关心后面是谁在转写。

### 6.2 分层归属

| 层 | 归属 | 理由 |
| --- | --- | --- |
| 采集（麦克风、权限、录音 UI） | 宠物 | 前端交互 |
| 转写（STT） | 站点 / 宿主 | 需要密钥、成本、隐私责任 |
| 理解（意图解析） | 中介者 | 只吃文本，不管来源 |

### 6.3 默认实现

浏览器 Web Speech API。若不可用（Firefox、部分 Safari），`available()` 返回 `false`，麦克风按钮不渲染。

站点可以提供自己的 `/api/stt` 覆盖默认实现——**密钥永远不进前端**。

**识别语言**：取浏览器 `navigator.language`（如 `zh-CN` / `en-US`），**不跟随界面语言**。
界面是中文、系统是英文时，识别仍按英文——决定口音的是用户系统设置，不是站点语言。
识别失败时的提示文案仍用界面语言。

### 6.4 隐私要求

- 首次点击麦克风才申请权限，并明确提示「音频由浏览器识别，不上传本站」。
- 不做后台常听、不做唤醒词。
- 识别中可随时取消。
- 音频不落盘、不进日志。

### 6.5 语音不绕过规则

语音只是把「声音」变成「文本」，后续走和打字完全一样的解析链路。不允许语音直接触发动作。

---

## 7. 降级矩阵

| 情况 | 行为 |
| --- | --- |
| 没有 `actions` 配置 | 退回打印链接 |
| 选择器找不到元素 | `deny: not-found`，宠物说「没找到」 |
| 元素被禁用 / 不可见 | `deny: not-available` |
| 地址跨域 | `deny: not-same-origin`，不执行 |
| 用户拒绝 | `deny: user`，本次会话不再问 |
| 冷却中 | `deny: cooling`，不提示 |
| 不支持语音 | 隐藏麦克风按钮 |
| 转写失败 | 气泡显示「没听清，再说一次？」 |

---

## 8. 审计

所有相关事件写入内核环形日志，`PetDebug.log()` 可导出：

```
12:00:01 request  open-post   direct
12:00:01 confirm  open-post   user
12:00:02 grant    open-post   once
12:00:02 done     open-post   ok
```

被拒绝的请求同样记录，便于排查「为什么没反应」。

---

## 9. 测试计划

| 类型 | 用例 |
| --- | --- |
| 单元 | 选择器解析、同源校验、冷却、授权存储 |
| 单元 | `sideEffect` 强制 `ask`，`always` 被拒 |
| 端到端 | 确认按钮 → 跳转成功 |
| 端到端 | 用户拒绝 → 不跳转且不再追问 |
| 端到端 | 元素不存在 → 气泡提示 |
| 端到端 | 无 `actions` 配置 → 行为与今天一致 |

---

## 10. 版本路线

| 版本 | 内容 |
| --- | --- |
| 下一大版本 · 第一步 | 只读导航 + 确认气泡 + 同源校验 + 审计 |
| 下一大版本 · 第二步 | 语音输入（Web Speech，可替换 provider） |
| 之后 | 站点 → 宠物指令通道、多能力编排 |

---

## 11. 待定问题

1. 多语言 `label` 是否需要 `label.en`？
2. 是否提供键盘路径（Tab 到确认按钮）——无障碍上建议要。
3. 「永久允许」的撤销入口放在气泡里还是设置页？

## 12. 决定记录

| 日期 | 决定 |
| --- | --- |
| 2026-10-26 | PJAX / 换页后重新解析目标元素，不跨页缓存 |
| 2026-10-26 | 语音识别语言跟随浏览器 `navigator.language`，不跟随界面语言 |
