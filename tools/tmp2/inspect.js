const fs = require('fs');

const t = fs.readFileSync('js/pet/index.js', 'utf8');
const ids = [...t.matchAll(/getElementById\('([^']+)'\)/g)].map((x) => x[1]);
console.log('getElementById:', [...new Set(ids)].join(', '));

const tags = [...t.matchAll(/createElement\('(\w+)'\)/g)].map((x) => x[1]);
console.log('createElement:', [...new Set(tags)].join(', '));

const css = fs.readFileSync('css/deepseek-pet.css', 'utf8');
const cls = [...css.matchAll(/\.(dp-[\w-]+)/g)].map((x) => x[1]);
console.log('CSS 作用域前缀:', [...new Set(cls)].slice(0, 6).join(', '), '… 共', new Set(cls).size, '个类');

const cfg = fs.readFileSync('js/pet/config.js', 'utf8');
const host = /"hostId": "([^"]+)"/.exec(cfg);
console.log('hostId:', host && host[1]);
