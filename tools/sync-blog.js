/*!
 * sync-blog.js —— 把运行时同步进博客仓库
 *
 *   node tools/sync-blog.js            复制 + 校验
 *   node tools/sync-blog.js --check    只看差异，不动文件
 *   node tools/sync-blog.js --build    复制 + 校验 + npx hexo generate
 *
 * 只同步这三样（博客侧独有的东西不碰）：
 *   js/pet/**            → <blog>/source/js/pet/**
 *   css/deepseek-pet.css → <blog>/source/css/deepseek-pet.css
 *   images/pet/anim/**   → <blog>/source/images/pet/anim/**
 *
 * 素材目录是镜像式的：上游删掉的文件，博客里也会删掉。
 * 上一级 source/images/pet/whale-girl.png（博客自己的图）不在同步范围。
 *
 * 博客目录默认取 ../Blogs，可用环境变量 PET_BLOG_DIR 覆盖。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BLOG = process.env.PET_BLOG_DIR || path.resolve(ROOT, '..', 'Blogs');
const SRC = path.join(BLOG, 'source');

const CHECK = process.argv.includes('--check');
const BUILD = process.argv.includes('--build');

/* 同步项：src 相对 pet-lab，dst 相对博客 source */
const JOBS = [
    { src: 'js/pet', dst: 'js/pet', kind: 'dir' },
    { src: 'css/deepseek-pet.css', dst: 'css/deepseek-pet.css', kind: 'file' },
    { src: 'images/pet/anim', dst: 'images/pet/anim', kind: 'dir' }
];

/* 文本按 LF 归一化，二进制原样 */
const TEXT = /\.(md|js|css|yaml|yml|json|txt)$|(^|\/)LICENSE$/;

function read(p) {
    const raw = fs.readFileSync(p);
    return TEXT.test(p) ? Buffer.from(raw.toString('utf8').replace(/\r\n/g, '\n'), 'utf8') : raw;
}

function sha(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex');
}

function walkFiles(dir, base) {
    const out = [];
    for (const name of fs.readdirSync(dir).sort()) {
        const abs = path.join(dir, name);
        if (fs.statSync(abs).isDirectory()) out.push(...walkFiles(abs, base ? base + '/' + name : name));
        else out.push(base ? base + '/' + name : name);
    }
    return out;
}

function plan() {
    const add = [];
    const update = [];
    const remove = [];
    const same = [];

    for (const job of JOBS) {
        const srcAbs = path.join(ROOT, job.src);
        const dstAbs = path.join(SRC, job.dst);

        if (job.kind === 'file') {
            if (!fs.existsSync(dstAbs)) add.push(job.dst);
            else if (sha(read(srcAbs)) !== sha(read(dstAbs))) update.push(job.dst);
            else same.push(job.dst);
            continue;
        }

        const want = walkFiles(srcAbs, '');
        const have = fs.existsSync(dstAbs) ? walkFiles(dstAbs, '') : [];

        for (const rel of want) {
            const dst = job.dst + '/' + rel;
            const dAbs = path.join(dstAbs, rel);
            if (!fs.existsSync(dAbs)) add.push(dst);
            else if (sha(read(path.join(srcAbs, rel))) !== sha(read(dAbs))) update.push(dst);
            else same.push(dst);
        }
        for (const rel of have) {
            if (!want.includes(rel)) remove.push(job.dst + '/' + rel);
        }
    }
    return { add, update, remove, same };
}

function apply() {
    for (const job of JOBS) {
        const srcAbs = path.join(ROOT, job.src);
        const dstAbs = path.join(SRC, job.dst);

        if (job.kind === 'file') {
            fs.mkdirSync(path.dirname(dstAbs), { recursive: true });
            fs.writeFileSync(dstAbs, read(srcAbs));
            continue;
        }

        for (const rel of walkFiles(srcAbs, '')) {
            const dst = path.join(dstAbs, rel);
            fs.mkdirSync(path.dirname(dst), { recursive: true });
            fs.writeFileSync(dst, read(path.join(srcAbs, rel)));
        }
    }
}

function verify(p) {
    if (p.add.length || p.update.length || p.remove.length) {
        console.error('✗ 复制后仍有差异，可能被别的东西改回去了');
        process.exit(1);
    }
}

/* ==================== 主流程 ==================== */

if (!fs.existsSync(SRC)) {
    console.error('✗ 找不到博客目录: ' + BLOG + '（用环境变量 PET_BLOG_DIR 指定）');
    process.exit(1);
}

const p = plan();
console.log('博客目录：' + BLOG);
console.log('  新增 ' + p.add.length + ' · 更新 ' + p.update.length + ' · 删除 ' + p.remove.length + ' · 未变 ' + p.same.length);

for (const f of p.add.slice(0, 10)) console.log('  + ' + f);
for (const f of p.update.slice(0, 10)) console.log('  ~ ' + f);
for (const f of p.remove.slice(0, 10)) console.log('  - ' + f);

/* 博客里没人读的旧文件，顺手提醒一下 */
const dead = path.join(SRC, 'js', 'pet-config.json');
if (fs.existsSync(dead)) {
    console.log('  提示：source/js/pet-config.json 没有任何代码引用，可以删掉（不进同步清单）');
}

if (CHECK) {
    console.log(p.add.length + p.update.length + p.remove.length ? '\n有差异，运行不带 --check 的命令来同步。' : '\n已是最新。');
    process.exit(0);
}

if (p.add.length || p.update.length || p.remove.length) {
    apply();
    for (const rel of p.remove) fs.rmSync(path.join(SRC, rel), { force: true });
    const after = plan();
    verify(after);
    console.log('  已同步并校验通过');
} else {
    console.log('  无需改动');
}

if (!BUILD) process.exit(0);

console.log('\n构建中：npx hexo generate');
/* 优先用博客自己的 hexo 入口，避免 shell 与 npx 的转义问题 */
const hexoBin = path.join(BLOG, 'node_modules', 'hexo', 'bin', 'hexo');
const r = fs.existsSync(hexoBin)
    ? spawnSync(process.execPath, [hexoBin, 'generate'], { cwd: BLOG, encoding: 'utf8' })
    : spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx',
        ['hexo', 'generate'], { cwd: BLOG, encoding: 'utf8', shell: process.platform === 'win32' });
const out = (r.stdout || '') + (r.stderr || '');
const line = out.split('\n').find((l) => /pet version:/.test(l));
if (r.status !== 0) {
    console.error('✗ 构建失败：\n' + out.split('\n').slice(-8).join('\n'));
    process.exit(1);
}
console.log('  ' + (line || '').trim().replace(/^INFO\s+/, ''));
