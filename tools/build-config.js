/*
 * build-config.js —— 配置编译 + 默认值管理
 *
 * 用法：
 *   node tools/build-config.js              # config/pet.yaml → js/pet-config.json + js/pet/config.js
 *   node tools/build-config.js --reset      # 用 config/pet.default.yaml 覆盖 pet.yaml（先备份），再编译
 *   node tools/build-config.js --snapshot   # 把当前 pet.yaml 存成新的默认值（config/pet.default.yaml）
 *   node tools/build-config.js --check      # 只校验，不写运行期文件
 *
 * 默认值单独放一份 pet.default.yaml：编辑器里的「恢复默认」读的就是它，
 * 重置不用重装一遍，也不会跟代码里的兜底常量各说一套。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'config', 'pet.yaml');
const DEF = path.join(ROOT, 'config', 'pet.default.yaml');
const OUT_JSON = path.join(ROOT, 'js', 'pet-config.json');
const OUT_JS = path.join(ROOT, 'js', 'pet', 'config.js');

const args = process.argv.slice(2);
const has = (f) => args.indexOf(f) >= 0;

function loadYaml() {
    const candidates = [
        'js-yaml',
        path.join(ROOT, 'node_modules', 'js-yaml'),
        path.join(ROOT, 'vendor', 'js-yaml.min.js'),   // 发行包自带，免 npm install
        path.join(ROOT, '..', 'Blogs', 'node_modules', 'js-yaml')
    ];
    for (const c of candidates) {
        try { return require(c); } catch (e) { /* next */ }
    }
    console.error('js-yaml not found: expected vendor/js-yaml.min.js or npm i -D js-yaml');
    process.exit(1);
}

const yaml = loadYaml();

function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

function backup() {
    const dir = path.join(ROOT, 'config', '.backup');
    fs.mkdirSync(dir, { recursive: true });
    const name = 'pet-' + stamp() + '.yaml';
    fs.copyFileSync(SRC, path.join(dir, name));
    const files = fs.readdirSync(dir).filter((f) => /^pet-.*\.yaml$/.test(f)).sort();
    while (files.length > 30) fs.unlinkSync(path.join(dir, files.shift()));
    return name;
}

/* ---- 恢复默认：用默认文件覆盖 pet.yaml ---- */
if (has('--reset')) {
    if (!fs.existsSync(DEF)) {
        console.error('缺少 ' + path.relative(ROOT, DEF) + '；先用 --snapshot 生成一份');
        process.exit(1);
    }
    const b = backup();
    fs.copyFileSync(DEF, SRC);
    console.log('已恢复默认配置（旧文件备份为 config/.backup/' + b + '）');
}

/* ---- 把当前配置存成默认值 ---- */
if (has('--snapshot')) {
    fs.copyFileSync(SRC, DEF);
    console.log('已把当前 config/pet.yaml 存为默认值：' + path.relative(ROOT, DEF));
}

const text = fs.readFileSync(SRC, 'utf8');

let cfg;
try {
    cfg = yaml.load(text);
} catch (e) {
    console.error('YAML parse failed: ' + e.message);
    process.exit(1);
}

if (!cfg || typeof cfg !== 'object') {
    console.error('config is empty or not an object');
    process.exit(1);
}

/* 默认值与当前值的段落差异：只提示，不改文件 */
if (fs.existsSync(DEF)) {
    let def = null;
    try { def = yaml.load(fs.readFileSync(DEF, 'utf8')); } catch (e) { /* ignore */ }
    if (def && typeof def === 'object') {
        const a = Object.keys(def), b = Object.keys(cfg);
        const missing = a.filter((k) => b.indexOf(k) < 0);
        const extra = b.filter((k) => a.indexOf(k) < 0);
        if (missing.length) console.log('提示：默认配置里有、当前没有的段：' + missing.join(', '));
        if (extra.length) console.log('提示：当前多出来的段：' + extra.join(', '));
    }
}

if (has('--check')) {
    console.log('yaml ok, keys: ' + Object.keys(cfg).join(', '));
    process.exit(0);
}

fs.writeFileSync(OUT_JSON, JSON.stringify(cfg, null, 2) + '\n', 'utf8');

const js = '/* generated from config/pet.yaml by tools/build-config.js -- do not edit */\n' +
    'export default ' + JSON.stringify(cfg, null, 4) + ';\n';
fs.writeFileSync(OUT_JS, js, 'utf8');

console.log('yaml ok, keys: ' + Object.keys(cfg).join(', '));
console.log('written: ' + path.relative(ROOT, OUT_JSON) + ' & ' + path.relative(ROOT, OUT_JS));
