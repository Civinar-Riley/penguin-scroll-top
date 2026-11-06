import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const norm = (s) => s.replace(/\r\n?/g, '\n').replace(/\n$/, '');
const meta = JSON.parse(norm(readFileSync('src/script.meta.json', 'utf8')));
const content = norm(readFileSync('src/penguin-scroll-top.js', 'utf8'));
const cdnContent = norm(readFileSync('src/penguin-scroll-top.cdn.js', 'utf8'));
mkdirSync('dist', { recursive: true });

const { cdn, ...exportMeta } = meta; // cdn 块只供构建用，不进产物
// 自包含版：脚本本体内置；CDN 加载器版：content 为一行 import，实时拉 main 分支
const variants = [
  { name: meta.name, info: meta.info, content },
  { name: meta.name + cdn.suffix, info: meta.info + cdn.info_note, content: cdnContent }
];
for (const v of variants) {
  const file = `dist/酒馆助手脚本-${v.name}.json`;
  writeFileSync(file, JSON.stringify({ ...exportMeta, name: v.name, info: v.info, content: v.content }, null, 2) + '\n', 'utf8');
  console.log(`build -> ${file} (content ${v.content.length} chars)`);
}
