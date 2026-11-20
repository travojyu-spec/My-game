// Проверка ассетов: все файлы из обоих каталогов на месте, оригиналы ChatGPT не изменены.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

type Img = { key: string; url: string; sha256?: string };
let bad = 0;
for (const path of ['public/assets/manifest.json', 'public/assets/chatgpt/manifest.json']) {
  const m = JSON.parse(readFileSync(path, 'utf8')) as { images: Img[] };
  for (const img of m.images) {
    const file = 'public/' + img.url;
    if (!existsSync(file)) { console.error('Нет файла:', file); bad++; continue; }
    if (img.sha256) {
      const sum = createHash('sha256').update(readFileSync(file)).digest('hex');
      if (sum !== img.sha256) { console.error('Изменён оригинал:', file); bad++; }
    }
  }
  console.log(`${path}: ${m.images.length} изображений`);
}
if (bad) process.exit(1);
console.log('Ассеты в порядке.');
