/*!
 * release.js —— 打一个发行版：组装 → 校验 → 打包 → （可选）推送并发布
 *
 *   node tools/release.js 1.0.2                 只在本地产出，打印计划
 *   node tools/release.js 1.0.2 --push          推 release 分支、打 tag、建 GitHub Release
 *   node tools/release.js 1.0.2 --push --force  覆盖已存在的 tag / 脏工作区
 *
 * 产物：
 *   build/pet-lab-<ver>/            发行目录（只含运行时、素材、配置、许可）
 *   build/pet-lab-v<ver>.zip        压缩包（内容清单固定，同样的输入永远同一个 sha256）
 *   build/pet-lab-v<ver>.zip.sha256
 *
 * 设计约束：
 *   - 发行内容和开发内容分开维护：这里用白名单，不是黑名单
 *   - 不信任"看起来成功了"：每一步都回读产物校验
 *   - 不联网也能跑（--push 之前全部是本地操作）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const BUILD = path.join(ROOT, 'build');

/* ==================== 参数 ==================== */

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const version = argv.find((a) => /^\d+\.\d+\.\d+$/.test(a));

if (!version) {
    console.error('用法：node tools/release.js <版本号，如 1.0.2> [--push] [--force]');
    process.exit(1);
}

const PUSH = flags.has('--push');
const FORCE = flags.has('--force');
const TAG = 'v' + version;
const DIST_REPO = process.env.PET_DIST_DIR || path.resolve(ROOT, '..', 'pet-dist');
const NOTES = path.join(ROOT, 'release', 'notes', version + '.md');
const STAGE = path.join(BUILD, 'pet-lab-' + version);
const ZIP = path.join(BUILD, 'pet-lab-v' + version + '.zip');
const SUM = ZIP + '.sha256';

/* ==================== 发行清单（白名单） ==================== */

/* 相对仓库根的路径；目录会整棵带上 */
const SHIP = [
    'LICENSE',
    'LICENSE-ASSETS.md',
    'CREDITS.md',
    'config/pet.yaml',
    'css/deepseek-pet.css',
    'js/pet/index.js',
    'js/pet/core.js',
    'js/pet/adapter.js',
    'js/pet/config.js',
    'js/pet/package.json',
    'js/pet/modules/actions.js',
    'js/pet/modules/machine.js',
    'js/pet/modules/player.js',
    'js/pet/modules/renderers.js',
    'js/pet/modules/rules.js',
    'js/pet/modules/search.js',
    'js/pet/modules/speech.js',
    'js/pet/modules/zones.js',
    'tools/build-config.js',
    'vendor/js-yaml.min.js',
    'vendor/js-yaml.LICENSE'
];

/* 这些永远不该出现在发行包里 */
const FORBIDDEN = [
    'tools/manual/', 'tools/tests/', 'tools/serve.py', 'tools/run-tests.js', 'tools/smoke.js',
    'HANDOFF', 'STATUS', 'KNOWN-ISSUES', 'screenshots/', '__pycache__', '.pyc',
    'config-editor.html', 'rules-editor.html', 'zone-editor.html', 'docs.html',
    'home.html', 'tests.html', 'pets.html', 'start.bat', '.git/'
];

/* ==================== 小工具 ==================== */

function walk(dir, base, out) {
    for (const name of fs.readdirSync(dir).sort()) {
        const abs = path.join(dir, name);
        const rel = base ? base + '/' + name : name;
        const st = fs.statSync(abs);
        if (st.isDirectory()) walk(abs, rel, out);
        else out.push({ rel, abs });
    }
    return out;
}

function sha256(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex');
}

function run(cmd, args, opts) {
    const r = spawnSync(cmd, args, Object.assign({ cwd: ROOT, encoding: 'utf8' }, opts));
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

/* ==================== ZIP（确定性） ==================== */

const CRC_TABLE = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
    }
    return t;
})();

function crc32(buf) {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
}

/**
 * 固定时间戳 + 固定顺序 = 同样的输入永远得到同一个 sha256，
 * 方便在别的机器上复核。
 */
function makeZip(entries) {
    const DOS_TIME = 0;
    const DOS_DATE = ((2020 - 1980) << 9) | (1 << 5) | 1;   // 2020-01-01
    const locals = [];
    const centrals = [];
    let offset = 0;

    for (const e of entries) {
        const nameBuf = Buffer.from(e.name, 'utf8');
        const raw = e.data;
        const deflated = zlib.deflateRawSync(raw, { level: 9 });
        const store = deflated.length >= raw.length;
        const body = store ? raw : deflated;
        const method = store ? 0 : 8;
        const crc = crc32(raw);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6);        // UTF-8 文件名
        local.writeUInt16LE(method, 8);
        local.writeUInt16LE(DOS_TIME, 10);
        local.writeUInt16LE(DOS_DATE, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(body.length, 18);
        local.writeUInt32LE(raw.length, 22);
        local.writeUInt16LE(nameBuf.length, 26);
        local.writeUInt16LE(0, 28);
        locals.push(local, nameBuf, body);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(method, 10);
        central.writeUInt16LE(DOS_TIME, 12);
        central.writeUInt16LE(DOS_DATE, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(body.length, 20);
        central.writeUInt32LE(raw.length, 24);
        central.writeUInt16LE(nameBuf.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt16LE(0, 34);
        central.writeUInt16LE(0, 36);
        central.writeUInt32LE(0, 38);
        central.writeUInt32LE(offset, 42);
        centrals.push(central, nameBuf);

        offset += local.length + nameBuf.length + body.length;
    }

    const cd = Buffer.concat(centrals);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(cd.length, 12);
    eocd.writeUInt32LE(offset, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([Buffer.concat(locals), cd, eocd]);
}

/* ==================== 1. 组装 ==================== */

function stage() {
    fs.rmSync(STAGE, { recursive: true, force: true });
    fs.mkdirSync(STAGE, { recursive: true });

    const files = [];
    for (const rel of SHIP) {
        const abs = path.join(ROOT, rel);
        if (!fs.existsSync(abs)) fail('清单里的文件不存在: ' + rel);
        fs.mkdirSync(path.join(STAGE, path.dirname(rel)), { recursive: true });
        fs.copyFileSync(abs, path.join(STAGE, rel));
        files.push(rel);
    }

    const animDir = path.join(ROOT, 'images', 'pet');
    for (const f of walk(animDir, 'images/pet', [])) {
        fs.mkdirSync(path.join(STAGE, path.dirname(f.rel)), { recursive: true });
        fs.copyFileSync(f.abs, path.join(STAGE, f.rel));
        files.push(f.rel);
    }

    /* 发行版 README 是单独维护的，版本号在打包时替换 */
    const readmeTpl = fs.readFileSync(path.join(ROOT, 'release', 'README.md'), 'utf8');
    fs.writeFileSync(path.join(STAGE, 'README.md'), readmeTpl.replace(/\{\{VERSION\}\}/g, 'v' + version));
    files.push('README.md');

    return files.sort();
}

/* ==================== 2. 校验 ==================== */

function fail(msg) {
    console.error('\n✗ ' + msg);
    process.exit(1);
}

function verify(files) {
    const problems = [];

    for (const rel of files) {
        for (const bad of FORBIDDEN) {
            if (rel.includes(bad)) problems.push('混入开发文件: ' + rel);
        }
    }

    /* 运行时必须和仓库逐字节一致——防的就是"复制没执行但看起来成功" */
    for (const rel of files) {
        if (!/^(js|css|config|vendor|tools)\//.test(rel)) continue;
        const a = sha256(fs.readFileSync(path.join(ROOT, rel)));
        const b = sha256(fs.readFileSync(path.join(STAGE, rel)));
        if (a !== b) problems.push('与仓库不一致: ' + rel);
    }

    /* 每个 JS 都要能过语法检查（js/pet 有 package.json 声明 ESM） */
    for (const rel of files.filter((f) => f.endsWith('.js'))) {
        const r = run('node', ['--check', path.join(STAGE, rel)]);
        if (r.code !== 0) problems.push('语法错误: ' + rel + ' — ' + r.out.split('\n')[0]);
    }

    /* README 的版本号必须是这次要发的版本 */
    const readme = fs.readFileSync(path.join(STAGE, 'README.md'), 'utf8');
    if (!readme.includes('v' + version)) problems.push('发行版 README 里没有版本号 v' + version);
    if (readme.includes('{{VERSION}}')) problems.push('发行版 README 的版本占位符没被替换');

    /* 配置编译链在发行包里也要能跑 */
    const cfg = run('node', [path.join(STAGE, 'tools', 'build-config.js')], { cwd: STAGE });
    if (cfg.code !== 0) problems.push('发行包里的 build-config.js 跑不通: ' + cfg.out.split('\n')[0]);
    else {
        const a = sha256(fs.readFileSync(path.join(ROOT, 'js', 'pet', 'config.js')));
        const b = sha256(fs.readFileSync(path.join(STAGE, 'js', 'pet', 'config.js')));
        if (a !== b) problems.push('用 pet.yaml 重新编译出的 config.js 与仓库版本不一致');
        fs.rmSync(path.join(STAGE, 'js', 'pet-config.json'), { force: true });   // 编译副产物，不发行
    }

    if (problems.length) {
        console.error('\n✗ 校验没通过：');
        problems.forEach((p) => console.error('  - ' + p));
        process.exit(1);
    }
}

/* ==================== 3. 打包 ==================== */

function pack(files) {
    fs.mkdirSync(BUILD, { recursive: true });
    const entries = files.map((rel) => ({
        name: 'pet-lab-' + version + '/' + rel,
        data: fs.readFileSync(path.join(STAGE, rel))
    }));
    const buf = makeZip(entries);
    fs.writeFileSync(ZIP, buf);
    const hash = sha256(buf);
    fs.writeFileSync(SUM, hash + '  pet-lab-v' + version + '.zip\n');
    return { hash, size: buf.length, count: files.length };
}

/* ==================== 4. 推送（可选） ==================== */

function git(args, cwd) {
    const r = run('git', args, { cwd });
    if (r.code !== 0) fail('git ' + args.join(' ') + ' 失败:\n' + r.out.trim());
    return r.out.trim();
}

function publish(info) {
    if (!fs.existsSync(NOTES)) fail('缺少发版说明: release/notes/' + version + '.md');

    if (!fs.existsSync(DIST_REPO)) fail('找不到发行仓库: ' + DIST_REPO + '（可用环境变量 PET_DIST_DIR 指定）');

    const dirty = git(['status', '--porcelain'], DIST_REPO);
    if (dirty && !FORCE) fail('发行仓库有未提交的改动，先清理或加 --force:\n' + dirty);

    if (git(['tag', '-l', TAG], DIST_REPO) && !FORCE) fail('标签 ' + TAG + ' 已存在，加 --force 才会覆盖');

    /* 镜像式同步：发行仓库里只该有 build/pet-lab-<ver>/ 的内容 */
    for (const name of fs.readdirSync(DIST_REPO)) {
        if (name === '.git') continue;
        fs.rmSync(path.join(DIST_REPO, name), { recursive: true, force: true });
    }
    for (const name of fs.readdirSync(STAGE)) {
        fs.cpSync(path.join(STAGE, name), path.join(DIST_REPO, name), { recursive: true });
    }

    git(['add', '-A'], DIST_REPO);
    git(['-c', 'user.name=JokeVallen', '-c', 'user.email=JokeVallen@users.noreply.github.com',
        'commit', '-m', 'pet-lab ' + TAG], DIST_REPO);
    git(['push', 'origin', 'release'], DIST_REPO);
    git(['-c', 'user.name=JokeVallen', '-c', 'user.email=JokeVallen@users.noreply.github.com',
        'tag', '-f', '-a', TAG, '-m', 'pet-lab ' + TAG], DIST_REPO);
    git(['push', '--force', 'origin', 'refs/tags/' + TAG], DIST_REPO);

    const title = process.env.PET_RELEASE_TITLE || TAG;
    const gh = run('gh', ['release', 'create', TAG, '--repo', 'JokeVallen/pet-lab',
        '--title', title, '--notes-file', NOTES, '--latest', '--target', 'release',
        ZIP, SUM]);
    if (gh.code !== 0) fail('gh release create 失败:\n' + gh.out.trim());

    /* 回读：远端附件的 sha256 必须和本地产物一致 */
    const api = run('gh', ['api', 'repos/JokeVallen/pet-lab/releases/tags/' + TAG,
        '--jq', '.assets[] | .name + " " + .digest']);
    const digestLine = api.out.split('\n').find((l) => l.startsWith('pet-lab-v' + version + '.zip ')) || '';
    if (!digestLine.includes(info.hash)) {
        fail('远端附件校验值对不上：\n  本地 ' + info.hash + '\n  远端 ' + (digestLine || '（没取到）'));
    }
    return { branch: git(['rev-parse', '--short', 'HEAD'], DIST_REPO) };
}

/* ==================== 主流程 ==================== */

console.log('版本：' + TAG + '   模式：' + (PUSH ? '推送并发布' : '只本地构建'));

const files = stage();
console.log('  组装：' + files.length + ' 个文件 → ' + path.relative(ROOT, STAGE));

verify(files);
console.log('  校验：通过');

const info = pack(files);
console.log('  打包：' + path.relative(ROOT, ZIP) + '（' + (info.size / 1024 / 1024).toFixed(2) + ' MB）');
console.log('  sha256：' + info.hash);

if (!PUSH) {
    console.log('\n本地完成。加 --push 才会推送并建 Release。');
    process.exit(0);
}

const res = publish(info);
console.log('\n✓ 已发布 ' + TAG + '（release 分支 ' + res.branch + '）');
console.log('  https://github.com/JokeVallen/pet-lab/releases/tag/' + TAG);
