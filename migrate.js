import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiDir = path.join(__dirname, 'api');
const routesDir = path.join(apiDir, '_routes');
const libDir = path.join(apiDir, '_lib');

if (!fs.existsSync(routesDir)) {
  fs.mkdirSync(routesDir);
}

function processDirectory(dir, basePath = '') {
  const items = fs.readdirSync(dir);
  const routeEntries = [];

  for (const item of items) {
    // Пропускаем служебные файлы и уже созданный роутер
    if (item === '_lib' || item === '_routes' || item === '[...path].ts') continue;

    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const subPath = basePath ? `${basePath}/${item}` : item;
      routeEntries.push(...processDirectory(fullPath, subPath));
      // Пытаемся удалить старую папку, если она осталась пустой
      try { fs.rmdirSync(fullPath); } catch (e) {}
    } else if (item.endsWith('.ts')) {
      const routeName = basePath ? `${basePath}/${item.replace('.ts', '')}` : item.replace('.ts', '');
      const destDir = path.join(routesDir, basePath);
      
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const destPath = path.join(destDir, item);
      let content = fs.readFileSync(fullPath, 'utf8');

      // 1. Динамически пересчитываем пути импортов для папки _lib
      content = content.replace(/from\s+['"]([^'"]+)['"]/g, (match, importPath) => {
        if (importPath.includes('_lib/')) {
          const suffix = importPath.split('_lib/')[1];
          let relPath = path.relative(destDir, libDir).replace(/\\/g, '/');
          if (!relPath.startsWith('.')) relPath = './' + relPath;
          return `from '${relPath}/${suffix}'`;
        }
        return match;
      });

      // 2. Вычищаем локальную обработку withCors (теперь она глобальная)
      content = content.replace(/withCors\s*,\s*/g, '');
      content = content.replace(/,\s*withCors/g, '');
      content = content.replace(/\{\s*withCors\s*\}/g, '{}');
      content = content.replace(/import\s*\{\s*\}\s*from\s+['"][^'"]+['"];?/g, '');
      content = content.replace(/\s*if\s*\(\s*withCors\s*\(\s*req\s*,\s*res\s*\)\s*\)\s*return;?/g, '');

      fs.writeFileSync(destPath, content);
      fs.unlinkSync(fullPath); // Удаляем исходный файл

      routeEntries.push(routeName);
    }
  }
  return routeEntries;
}

const routes = processDirectory(apiDir);

// 3. Генерируем единый файл-роутер
const imports = routes.map((route, i) => `import handler_${i} from './_routes/${route}';`).join('\n');
const handlers = routes.map((route, i) => `    if (route === '${route}') return await handler_${i}(req, res);`).join('\n');

const catchAllCode = `import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withCors, sendError } from './_lib/helpers'

${imports}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Глобально обрабатываем CORS для всех API-запросов
  if (withCors(req, res)) return;

  const pathArray = req.query.path as string[] || [];
  const route = pathArray.join('/');

  try {
${handlers}

    return sendError(res, 404, \`Маршрут API /api/\${route} не найден\`);
  } catch (error) {
    console.error(\`Ошибка в обработчике \${route}:\`, error);
    return sendError(res, 500, 'Внутренняя ошибка сервера');
  }
}
`;

fs.writeFileSync(path.join(apiDir, '[...path].ts'), catchAllCode);
console.log(`✅ Рефакторинг успешно завершен! Обработано функций: ${routes.length}`);
