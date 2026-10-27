/*!
 * build-config.js —— config/pet.yaml → js/pet-config.json + js/modules/config.js
 *
 * 用 js-yaml（4.x）解析，不自研解析器。
 * 依赖查找顺序：本仓库 node_modules → 相邻博客仓库 node_modules（Hexo 自带）。
 * 用法：node tools/build-config.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'config', 'pet.yaml');
const OUT_JSON = path.join(ROOT, 'js', 'pet-config.json');
const OUT_JS = path.join(ROOT, 'js', 'pet', 'config.js');

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

fs.writeFileSync(OUT_JSON, JSON.stringify(cfg, null, 2) + '\n', 'utf8');

const js = '/* generated from config/pet.yaml by tools/build-config.js -- do not edit */\n' +
    'export default ' + JSON.stringify(cfg, null, 4) + ';\n';
fs.writeFileSync(OUT_JS, js, 'utf8');

console.log('yaml ok, keys: ' + Object.keys(cfg).join(', '));
console.log('written: ' + path.relative(ROOT, OUT_JSON) + ' & ' + path.relative(ROOT, OUT_JS));
