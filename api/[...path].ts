import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withCors, sendError } from './_lib/helpers'

import handler_0 from './routes/backup';
import handler_1 from './routes/daily-measurements/latest/[tankName]';
import handler_2 from './routes/daily-measurements';
import handler_3 from './routes/dashboard/activity';
import handler_4 from './routes/dashboard/summary';
import handler_5 from './routes/dashboard/timeline/[workdayId]';
import handler_6 from './routes/database/clear-operations';
import handler_7 from './routes/employees/all';
import handler_8 from './routes/employees/[id]/status';
import handler_9 from './routes/employees/[id]';
import handler_10 from './routes/employees';
import handler_11 from './routes/fuel-dispensing-tza';
import handler_12 from './routes/fuel-dispensing-vs';
import handler_13 from './routes/fuel-reception-auto';
import handler_14 from './routes/fuel-reception';
import handler_15 from './routes/in-warehouse';
import handler_16 from './routes/inventory';
import handler_17 from './routes/operations/edit-last';
import handler_18 from './routes/operations/last/[workdayId]';
import handler_19 from './routes/park-state';
import handler_20 from './routes/send-checklist';
import handler_21 from './routes/settings/logo';
import handler_22 from './routes/settings/telegram/test';
import handler_23 from './routes/settings/telegram';
import handler_24 from './routes/settings/texts';
import handler_25 from './routes/stock';
import handler_26 from './routes/system/core-metrics';
import handler_27 from './routes/system/setup-status';
import handler_28 from './routes/system/setup';
import handler_29 from './routes/tanks/all';
import handler_30 from './routes/tanks/[id]/status';
import handler_31 from './routes/tanks';
import handler_32 from './routes/tech-lines/[id]';
import handler_33 from './routes/tech-lines';
import handler_34 from './routes/telegram/webhook';
import handler_35 from './routes/train-report';
import handler_36 from './routes/trains';
import handler_37 from './routes/tza/[id]/monitoring';
import handler_38 from './routes/tza/[id]';
import handler_39 from './routes/tza';
import handler_40 from './routes/workdays/close';
import handler_41 from './routes/workdays/start';
import handler_42 from './routes/workdays';


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
    if (route === 'ping') return res.json({ ok: true, route, pathArray, supabase: !!process.env.SUPABASE_URL });

    if (route === 'backup') return await handler_0(req, res);
    
    // daily-measurements/latest/[tankName]
    if (pathArray.length === 3 && pathArray[0] === 'daily-measurements' && pathArray[1] === 'latest') {
      req.query.tankName = pathArray[2];
      return await handler_1(req, res);
    }
    
    if (route === 'daily-measurements') return await handler_2(req, res);
    if (route === 'dashboard/activity') return await handler_3(req, res);
    if (route === 'dashboard/summary') return await handler_4(req, res);
    
    // dashboard/timeline/[workdayId]
    if (pathArray.length === 3 && pathArray[0] === 'dashboard' && pathArray[1] === 'timeline') {
      req.query.workdayId = pathArray[2];
      return await handler_5(req, res);
    }
    
    if (route === 'database/clear-operations') return await handler_6(req, res);
    if (route === 'employees/all') return await handler_7(req, res);
    
    // employees/[id]/status
    if (pathArray.length === 3 && pathArray[0] === 'employees' && pathArray[2] === 'status') {
      req.query.id = pathArray[1];
      return await handler_8(req, res);
    }
    
    // employees/[id]
    if (pathArray.length === 2 && pathArray[0] === 'employees') {
      req.query.id = pathArray[1];
      return await handler_9(req, res);
    }
    
    if (route === 'employees') return await handler_10(req, res);
    if (route === 'fuel-dispensing-tza') return await handler_11(req, res);
    if (route === 'fuel-dispensing-vs') return await handler_12(req, res);
    if (route === 'fuel-reception-auto') return await handler_13(req, res);
    if (route === 'fuel-reception') return await handler_14(req, res);
    if (route === 'in-warehouse') return await handler_15(req, res);
    if (route === 'inventory') return await handler_16(req, res);
    if (route === 'operations/edit-last') return await handler_17(req, res);
    
    // operations/last/[workdayId]
    if (pathArray.length === 3 && pathArray[0] === 'operations' && pathArray[1] === 'last') {
      req.query.workdayId = pathArray[2];
      return await handler_18(req, res);
    }
    
    if (route === 'park-state') return await handler_19(req, res);
    if (route === 'send-checklist') return await handler_20(req, res);
    if (route === 'settings/logo') return await handler_21(req, res);
    if (route === 'settings/telegram/test') return await handler_22(req, res);
    if (route === 'settings/telegram') return await handler_23(req, res);
    if (route === 'settings/texts') return await handler_24(req, res);
    if (route === 'stock') return await handler_25(req, res);
    if (route === 'system/core-metrics') return await handler_26(req, res);
    if (route === 'system/setup-status') return await handler_27(req, res);
    if (route === 'system/setup') return await handler_28(req, res);
    if (route === 'tanks/all') return await handler_29(req, res);
    
    // tanks/[id]/status
    if (pathArray.length === 3 && pathArray[0] === 'tanks' && pathArray[2] === 'status') {
      req.query.id = pathArray[1];
      return await handler_30(req, res);
    }
    
    if (route === 'tanks') return await handler_31(req, res);
    
    // tech-lines/[id]
    if (pathArray.length === 2 && pathArray[0] === 'tech-lines') {
      req.query.id = pathArray[1];
      return await handler_32(req, res);
    }
    
    if (route === 'tech-lines') return await handler_33(req, res);
    if (route === 'telegram/webhook') return await handler_34(req, res);
    if (route === 'train-report') return await handler_35(req, res);
    if (route === 'trains') return await handler_36(req, res);
    
    // tza/[id]/monitoring
    if (pathArray.length === 3 && pathArray[0] === 'tza' && pathArray[2] === 'monitoring') {
      req.query.id = pathArray[1];
      return await handler_37(req, res);
    }
    
    // tza/[id]
    if (pathArray.length === 2 && pathArray[0] === 'tza') {
      req.query.id = pathArray[1];
      return await handler_38(req, res);
    }
    
    if (route === 'tza') return await handler_39(req, res);
    if (route === 'workdays/close') return await handler_40(req, res);
    if (route === 'workdays/start') return await handler_41(req, res);
    if (route === 'workdays') return await handler_42(req, res);

    return res.status(404).json({ error: `Маршрут API /api/${route} не найден`, isCustomRouter: true, pathArray, route });
  } catch (error) {
    console.error(`Ошибка в обработчике ${route}:`, error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера', isCustomRouter: true, details: (error as Error).message });
  }
}
