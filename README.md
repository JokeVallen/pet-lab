# 大肥鱼 · 博客桌宠 v1.0.2

一只住在网页角落的鲸鱼娘：透明视频立绘、分区点击反应、状态随机、情境台词、站内检索。
纯前端，不接任何 API，不需要 Key。

**这个包是发行版**：含运行所需的全部文件，外加四个离线的可视化编辑器（配置 / 分区 / 规则 / 文案）。
不含开发侧的东西——测试面板、项目状态、开发沿革、已知问题这些在打包时就已经从页面里删除，不是靠隐藏。
需要完整开发环境（探针脚本、单元测试、开发笔记），请用仓库：<https://github.com/JokeVallen/pet-lab>

打开 `index.html` 就是入口；`demo.html` 是宠物演示。

---

## 包里有什么

```
js/pet/            运行时（ES 模块，入口 index.js）
js/pet/config.js   生成的配置（运行时真正读这个）
config/pet.yaml    配置源文件（配 tools/build-config.js 使用）
css/deepseek-pet.css
images/pet/anim/   33 个带 alpha 的 VP9 WebM 片段 + 首帧 poster.webp
tools/build-config.js + vendor/   YAML → config.js 的编译器（自带 js-yaml）
index.html demo.html            首页与宠物演示
config-editor.html              配置编辑：外观、节奏、动作、状态
copy-editor.html                文案编辑：中英分开，支持 {name} 占位符与实时预览
zone-editor.html                分区编辑：身体框、鼠标反应
rules-editor.html               规则编辑：何时做什么
LICENSE LICENSE-ASSETS.md CREDITS.md
```

## 安装

### Hexo + Butterfly（本项目的目标环境）

1. 把 `js/pet/` 复制到博客的 `source/js/pet/`
2. 把 `css/deepseek-pet.css` 复制到 `source/css/`
3. 把 `images/pet/` 复制到 `source/images/pet/`
4. 在页面里加载模块（例如放进 `source/js/custom-global.js`）：

```js
(function () {
    function ensurePet() {
        if (document.querySelector('script[data-pet-module]')) return;
        var s = document.createElement('script');
        s.type = 'module';
        s.src = '/js/pet/index.js';
        s.dataset.petModule = '1';
        document.body.appendChild(s);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensurePet);
    else ensurePet();
    document.addEventListener('pjax:complete', ensurePet);   // 主题开 pjax 时
})();
```

5. 确认样式表被引入：`@import url("/css/deepseek-pet.css");`（或 `head` 里加 `<link>`）

### 任意静态站点

引入 `css/deepseek-pet.css`，再插一个 `<script type="module" src="/js/pet/index.js"></script>` 即可。
宠物自己创建 DOM 并挂到右下角。

## 改配置

所有角色相关的东西都在配置里（名字、台词、配色、尺寸、素材目录、状态、分区、规则）。

```bash
# 改 config/pet.yaml，然后重新生成 js/pet/config.js
node tools/build-config.js
```

发行包自带 `vendor/js-yaml.min.js`，**不需要 npm install**。

也可以直接编辑 `js/pet/config.js`（就是一个普通对象字面量），跳过编译步骤。
两者只需维护一个：用 YAML 就别手改 config.js，反之亦然。

### 换成别的宠物

`animDir` / `image` / `clipExt` / `hostId` / `size` / `accent` / `persona` 七个键决定角色外观与口吻；
`states` / `policy` / `zones` / `rules` 决定行为。换素材时把 `images/pet/anim` 换成新的即可，
路径不写死在代码里。详见仓库 README 的「换一只宠物」。

### 同页两只

模块地址带 `?pet=<名字>`，从 `window.PetProfiles` 取覆盖项：

```html
<script>window.PetProfiles = { cat: { hostId: 'pet-cat', storageKey: 'pet-cat-v1',
  offset: { x: 168 }, size: { width: 150, height: 133 },
  accent: { primary: '#f08a3c' }, persona: { name: '小橘' } } };</script>
<script type="module" src="/js/pet/index.js"></script>
<script type="module" src="/js/pet/index.js?pet=cat"></script>
```

`hostId` / `storageKey` / `offset` 三个必须各不相同。

## 授权

| 范围 | 协议 |
| --- | --- |
| 代码（`js/` `css/` 文档） | MIT — [LICENSE](LICENSE) |
| 素材（`images/`） | CC BY-NC-SA 4.0 — [LICENSE-ASSETS.md](LICENSE-ASSETS.md) |

素材**禁止商用**，公开使用需署名并保留上游仓库链接（作者与逐文件映射见 [CREDITS.md](CREDITS.md)）。

---

## English

A blog pet: a transparent-video character that idles in the corner of the page, reacts to clicks by
body zone, picks contextual lines, and answers site-search questions. Pure front-end, no API keys.

This archive is the **distribution only** — no editors, tests, probes or development notes. The full
development environment and visual editors live in the repository:
<https://github.com/JokeVallen/pet-lab>

**Install**: copy `js/pet/`, `css/deepseek-pet.css` and `images/pet/` into your site, link the
stylesheet, then add `<script type="module" src="/js/pet/index.js"></script>`.

**Configure**: edit `config/pet.yaml` and run `node tools/build-config.js` (js-yaml is vendored, no
`npm install` needed), or edit `js/pet/config.js` directly — pick one, don't mix.

**License**: code MIT, artwork CC BY-NC-SA 4.0 (non-commercial, attribution required).
