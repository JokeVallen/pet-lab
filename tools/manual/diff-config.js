const fs = require('fs');
const path = require('path');

const yamlPath = path.join('D:/Users/User/pet-lab/vendor/js-yaml.min.js');
const yaml = require(yamlPath);

const bad = yaml.load(fs.readFileSync('D:/Users/User/pet-lab/config/.backup/pet-20261026-194319.yaml', 'utf8'));
const good = yaml.load(fs.readFileSync('D:/Users/User/pet-lab/config/.backup/pet-20261026-130157.yaml', 'utf8'));

console.log('bad keys:', Object.keys(bad).join(', '));
console.log('good keys:', Object.keys(good).join(', '));

const REPORT = [];
function walk(a, b, p) {
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        const ka = Object.keys(a), kb = Object.keys(b);
        for (const k of ka) {
            if (!(k in b)) REPORT.push('新增: ' + p + '.' + k);
            else walk(a[k], b[k], p + '.' + k);
        }
        for (const k of kb) if (!(k in a)) REPORT.push('消失: ' + p + '.' + k);
        return;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) REPORT.push('长度: ' + p + ' ' + a.length + ' -> ' + b.length);
        for (let i = 0; i < Math.min(a.length, b.length); i++) walk(a[i], b[i], p + '[' + i + ']');
        return;
    }
    if (typeof a === 'string' && typeof b === 'string') {
        if (a !== b && /^[\x00-\x7f]*$/.test(a) && /^[\x00-\x7f]*$/.test(b)) {
            REPORT.push('ASCII差异: ' + p + ' ' + JSON.stringify(a) + ' != ' + JSON.stringify(b));
        }
    } else if (a !== b) {
        REPORT.push('值差异: ' + p + ' ' + JSON.stringify(a) + ' != ' + JSON.stringify(b));
    }
}
walk(bad, good, '');
console.log('\n=== 差异 ===');
console.log(REPORT.join('\n'));
