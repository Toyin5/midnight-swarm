import { readFile, writeFile } from 'node:fs/promises';

const binding = new URL('../src/managed/checkpoint/contract/index.js', import.meta.url);
const source = await readFile(binding, 'utf8');

await writeFile(binding, source.replace(/\n\/\/# sourceMappingURL=index\.js\.map\s*$/, '\n'));
