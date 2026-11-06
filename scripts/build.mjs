import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const meta = JSON.parse(readFileSync('src/script.meta.json', 'utf8'));
const content = readFileSync('src/penguin-scroll-top.js', 'utf8')
    .replace(/\r\n?/g, '\n')
    .replace(/\n$/, '');
mkdirSync('dist', { recursive: true });
const file = `dist/酒馆助手脚本-${meta.name}.json`;
writeFileSync(file, JSON.stringify({ ...meta, content }, null, 2) + '\n', 'utf8');
console.log(`build -> ${file} (content ${content.length} chars)`);
