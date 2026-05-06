import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withCors, sendError } from '../server/lib/helpers'


export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Глобально обрабатываем CORS для всех API-запросов
  if (withCors(req, res)) return;

  let pathStr = '';
  if (Array.isArray(req.query.path)) {
    pathStr = req.query.path.join('/');
  } else if (typeof req.query.path === 'string') {
    pathStr = req.query.path;
  } else {
    pathStr = (req.url || '').split('?')[0].replace(/^\/api\//, '').replace(/^\//, '');
  }
  
  const pathArray = pathStr.split('/').filter(Boolean);
  const route = pathArray.join('/');

  try {
    if (route === 'backup') return (await import('../server/routes/backup')).default(req, res);
    
    // daily-measurements/latest/[tankName]
    if (pathArray.length === 3 && pathArray[0] === 'daily-measurements' && pathArray[1] === 'latest') {
      req.query.tankName = pathArray[2];
      return (await import('../server/routes/daily-measurements/latest/[tankName]')).default(req, res);
    }
    
    if (route === 'daily-measurements') return (await import('../server/routes/daily-measurements')).default(req, res);
    if (route === 'dashboard/activity') return (await import('../server/routes/dashboard/activity')).default(req, res);
    if (route === 'dashboard/summary') return (await import('../server/routes/dashboard/summary')).default(req, res);
    
    // dashboard/timeline/[workdayId]
    if (pathArray.length === 3 && pathArray[0] === 'dashboard' && pathArray[1] === 'timeline') {
      req.query.workdayId = pathArray[2];
      return (await import('../server/routes/dashboard/timeline/[workdayId]')).default(req, res);
    }
    
    if (route === 'database/clear-operations') return (await import('../server/routes/database/clear-operations')).default(req, res);
    if (route === 'employees/all') return (await import('../server/routes/employees/all')).default(req, res);
    
    // employees/[id]/status
    if (pathArray.length === 3 && pathArray[0] === 'employees' && pathArray[2] === 'status') {
      req.query.id = pathArray[1];
      return (await import('../server/routes/employees/[id]/status')).default(req, res);
    }
    
    // employees/[id]
    if (pathArray.length === 2 && pathArray[0] === 'employees') {
      req.query.id = pathArray[1];
      return (await import('../server/routes/employees/[id]')).default(req, res);
    }
    
    if (route === 'employees') return (await import('../server/routes/employees')).default(req, res);
    if (route === 'fuel-dispensing-tza') return (await import('../server/routes/fuel-dispensing-tza')).default(req, res);
    if (route === 'fuel-dispensing-vs') return (await import('../server/routes/fuel-dispensing-vs')).default(req, res);
    if (route === 'fuel-reception-auto') return (await import('../server/routes/fuel-reception-auto')).default(req, res);
    if (route === 'fuel-reception') return (await import('../server/routes/fuel-reception')).default(req, res);
    if (route === 'in-warehouse') return (await import('../server/routes/in-warehouse')).default(req, res);
    if (route === 'inventory') return (await import('../server/routes/inventory')).default(req, res);
    if (route === 'operations/edit-last') return (await import('../server/routes/operations/edit-last')).default(req, res);
    
    // operations/last/[workdayId]
    if (pathArray.length === 3 && pathArray[0] === 'operations' && pathArray[1] === 'last') {
      req.query.workdayId = pathArray[2];
      return (await import('../server/routes/operations/last/[workdayId]')).default(req, res);
    }
    
    if (route === 'park-state') return (await import('../server/routes/park-state')).default(req, res);
    if (route === 'send-checklist') return (await import('../server/routes/send-checklist')).default(req, res);
    if (route === 'settings/logo') return (await import('../server/routes/settings/logo')).default(req, res);
    if (route === 'settings/telegram/test') return (await import('../server/routes/settings/telegram/test')).default(req, res);
    if (route === 'settings/telegram') return (await import('../server/routes/settings/telegram')).default(req, res);
    if (route === 'settings/texts') return (await import('../server/routes/settings/texts')).default(req, res);
    if (route === 'stock') return (await import('../server/routes/stock')).default(req, res);
    if (route === 'system/core-metrics') return (await import('../server/routes/system/core-metrics')).default(req, res);
    if (route === 'system/setup-status') return (await import('../server/routes/system/setup-status')).default(req, res);
    if (route === 'system/setup') return (await import('../server/routes/system/setup')).default(req, res);
    if (route === 'tanks/all') return (await import('../server/routes/tanks/all')).default(req, res);
    
    // tanks/[id]/status
    if (pathArray.length === 3 && pathArray[0] === 'tanks' && pathArray[2] === 'status') {
      req.query.id = pathArray[1];
      return (await import('../server/routes/tanks/[id]/status')).default(req, res);
    }
    
    if (route === 'tanks') return (await import('../server/routes/tanks')).default(req, res);
    
    // tech-lines/[id]
    if (pathArray.length === 2 && pathArray[0] === 'tech-lines') {
      req.query.id = pathArray[1];
      return (await import('../server/routes/tech-lines/[id]')).default(req, res);
    }
    
    if (route === 'tech-lines') return (await import('../server/routes/tech-lines')).default(req, res);
    if (route === 'telegram/webhook') return (await import('../server/routes/telegram/webhook')).default(req, res);
    if (route === 'train-report') return (await import('../server/routes/train-report')).default(req, res);
    if (route === 'trains') return (await import('../server/routes/trains')).default(req, res);
    
    // tza/[id]/monitoring
    if (pathArray.length === 3 && pathArray[0] === 'tza' && pathArray[2] === 'monitoring') {
      req.query.id = pathArray[1];
      return (await import('../server/routes/tza/[id]/monitoring')).default(req, res);
    }
    
    // tza/[id]
    if (pathArray.length === 2 && pathArray[0] === 'tza') {
      req.query.id = pathArray[1];
      return (await import('../server/routes/tza/[id]')).default(req, res);
    }
    
    if (route === 'tza') return (await import('../server/routes/tza')).default(req, res);
    if (route === 'workdays/close') return (await import('../server/routes/workdays/close')).default(req, res);
    if (route === 'workdays/start') return (await import('../server/routes/workdays/start')).default(req, res);
    if (route === 'workdays') return (await import('../server/routes/workdays')).default(req, res);

    return res.status(404).json({ error: `Маршрут API /api/${route} не найден`, isCustomRouter: true, pathArray, route });
  } catch (error) {
    console.error(`Ошибка в обработчике ${route}:`, error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера', isCustomRouter: true, details: (error as Error).message });
  }
}
