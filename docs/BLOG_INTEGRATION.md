# 接入本博客 / Integrating with this blog

> 这份文档写给**维护博客的人或 AI**。宠物本体是黑盒：只同步文件、只按约定加载，
> 不修改 `js/pet/` 里的任何代码，不猜测它的内部实现。
>
> For whoever (or whatever AI) maintains the blog. The pet is a black box: sync the files,
> load it as described, and never edit anything inside `js/pet/`.

---

## 0. 一句话版 / TL;DR

下载最新发行包，把 `js/pet/`、`css/deepseek-pet.css`、`images/pet/` 三个东西放到固定位置，
在全局脚本里带版本号加载 `/js/pet/index.js`，然后 build。

Download the latest release, drop `js/pet/`, `css/deepseek-pet.css` and `images/pet/` into place,
load `/js/pet/index.js` with a version query from your global script, and build.

---

## 1. 唯一的信息来源 / The only source

**发行包 Release**：<https://github.com/JokeVallen/pet-lab/releases/latest> （资产名 `pet-lab-v*.zip`）

**不要用仓库的 `main` 分支。** 那是开发环境，含测试面板、探针与开发笔记；发行包在打包时
已把开发侧内容删除。

Do **not** copy `js/pet/` from the `main` branch — that is the development environment. The release
archive has all developer-only content removed at pack time.

---

## 2. 目标形态 / Target layout

```
source/
  js/pet/                 整目录，来自发行包的 js/pet/
  css/deepseek-pet.css    单文件
  images/pet/             整目录，来自发行包的 images/pet/（33 个 WebM + poster）
config/pet.yaml           博客自己的配置，永远不从发行包覆盖
```

| 来源 | 去向 |
| --- | --- |
| `<zip>/js/pet/**` | `source/js/pet/**` |
| `<zip>/css/deepseek-pet.css` | `source/css/deepseek-pet.css` |
| `<zip>/images/pet/**` | `source/images/pet/**` |
| `<zip>/config/pet.yaml` | **不要复制**（博客已有自己的） |

---

## 3. 首次接入 / First-time install

1. 解压 `pet-lab-v*.zip`。
2. 复制上面表格里的三个目录 / 文件。
3. 在全局脚本（例如 `source/js/custom-global.js`）里加载模块：

```js
(function () {
    var V = '1.0.2';                          // 每次更新改这里
    function ensurePet() {
        if (document.querySelector('script[data-pet-module]')) return;
        var s = document.createElement('script');
        s.type = 'module';
        s.src = '/js/pet/index.js?v=' + V;     // 版本号是模块缓存失效的唯一手段
        s.dataset.petModule = '1';
        document.body.appendChild(s);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensurePet);
    else ensurePet();
    document.addEventListener('pjax:complete', ensurePet);   // 主题开 pjax 时
})();
```

4. 确认样式表被引入：`@import url("/css/deepseek-pet.css");` 或 `head` 里加 `<link>`。
5. `hexo clean && hexo g && hexo d`。

宠物自己创建 DOM 并挂到右下角，宿主页面**不需要**准备容器元素。

---

## 4. 更新 / Updating

1. 下载新版本 zip。
2. **先删后拷**（不要原地覆盖）：

```bash
rm -rf source/js/pet
cp -r <解压目录>/js/pet source/js/pet
```

> 为什么必须删：模块名会随版本变化（1.0.2 新增了 `content/expr.js`）。原地覆盖会留下
> 不再被引用的旧文件，出问题时无法判断实际加载的是哪一份。

3. `css/` 与 `images/` 只在发行说明提到时才替换（素材体积大，没必要每次重传）。
4. 改全局脚本里的 `V` 常量。
5. 重新构建，跑第 6 节的验证。

---

## 5. 绝对不能做 / Hard rules

| 禁止 | 原因 |
| --- | --- |
| 从 `main` 分支复制 `js/pet/` | 那是开发版，含测试与调试入口 |
| 修改 `js/pet/` 里的任何文件 | 下次更新会被覆盖，而且问题无法复现 |
| 用发行包的 `config/pet.yaml` 覆盖博客的 | 会丢掉博客自己的名字与台词 |
| 直接操作宠物创建的 DOM | 宠物持有 `#deepseek-pet` 子树，外部改动会破坏状态机 |
| 在宠物代码里写站点逻辑 | 站点能力只能通过 `window.SiteAPI` 提供 |

如果发现 bug：反馈回 `pet-lab` 仓库，**不要在博客里打补丁**。

---

## 6. 验证 / Verify

打开任意一篇博客文章，在控制台执行：

```js
document.getElementById('deepseek-pet')         // 应为元素，不是 null
document.querySelectorAll('.dp-root').length    // 应为 1，不能是 2
```

再看网络面板：**不应出现任何 4xx 请求**。宠物只会请求两类路径：

```
/js/pet/**
/images/pet/anim/**
```

常见问题对照：

| 现象 | 先看这里 |
| --- | --- |
| 宠物完全不出现 | 控制台有没有 `[pet]` 开头的报错；`/js/pet/index.js` 是否 200 |
| 出现了但全是空白 / 静止 | `/images/pet/anim/` 下的 WebM 是否 200 |
| 更新后仍是旧行为 | `V` 常量没改，或浏览器缓存了 `/js/pet/index.js` |
| 出现两只 | `hostId` 冲突，或 `ensurePet` 的去重被绕过 |
| 文案还是旧名字 | `js/pet/config.js` 没重新生成（`node tools/build-config.js`） |
| 样式全丢 | `css/deepseek-pet.css` 没引入，或路径写错 |

---

## 7. 站点能力接口 / Site capabilities

宠物与站点之间**只有一扇门**：`window.SiteAPI`。博客实现它，宠物就自动用上；不实现则静默降级，
不报错、不阻塞。

### 7.1 宠物会探测的模块（每一项都可选）

```
content / reading / bookmarks / notes / quiz / stats / userState / events
```

### 7.2 根对象上用到的成员

```
ready / readyContent / capabilities / health / currentContext / navigation / actions
```

### 7.3 两层加载

| 层 | 调用 | 代价 | 什么时候用 |
| --- | --- | --- | --- |
| 轻量 | `ready()` + `currentContext()` | 一个 `page-context.json`（几十 KB） | 挂载时立刻调 |
| 内容库 | `readyContent()` | `content-db.json`（MB 级） | 只有需要全文时 |

### 7.4 权限

| 等级 | 宠物用它做什么 |
| --- | --- |
| `read` | `currentContext()`、`content().search()` |
| `read-local` | `reading().get()`、`bookmarks().list()` |
| `write-local` | `userState()`、`actions().invoke(...)` |

写操作一律走 `actions().invoke`，且**不伪造 `confirmed`**：需要确认的交给站点自己弹窗，
用户拒绝就当没做。

### 7.5 没有 SiteAPI 也能跑

动作、对话、句库都在本地。少了的是"知道你正在看什么"：页面标题、标签、字数、阅读进度、
站内检索、阅读位置记忆。

---

## 8. 配置归谁 / Who owns the config

| 文件 | 归属 | 谁改 |
| --- | --- | --- |
| `js/pet/config.js` | 生成物 | 由 `config/pet.yaml` 编译而来，**不手改** |
| `config/pet.yaml` | 博客自己的 | 人 / AI 按需改 |
| `js/pet/` 其余 | 宠物本体 | **谁都不改** |

改完 YAML 后重新编译：

```bash
node tools/build-config.js
```

发行包自带 `vendor/js-yaml.min.js`，不需要 `npm install`。
