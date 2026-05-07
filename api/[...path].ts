import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withCors, sendError } from './lib/_lib/helpers'

import handler_0 from './handlers/backup';
import handler_1 from './handlers/daily-measurements/latest/[tankName]';
import handler_2 from './handlers/daily-measurements';
import handler_3 from './handlers/dashboard/activity';
import handler_4 from './handlers/dashboard/summary';
import handler_5 from './handlers/dashboard/timeline/[workdayId]';
import handler_6 from './handlers/database/clear-operations';
import handler_7 from './handlers/employees/all';
import handler_8 from './handlers/employees/[id]/status';
import handler_9 from './handlers/employees/[id]';
import handler_10 from './handlers/employees';
import handler_11 from './handlers/fuel-dispensing-tza';
import handler_12 from './handlers/fuel-dispensing-vs';
import handler_13 from './handlers/fuel-reception-auto';
import handler_14 from './handlers/fuel-reception';
import handler_15 from './handlers/in-warehouse';
import handler_16 from './handlers/inventory';
import handler_17 from './handlers/operations/edit-last';
import handler_18 from './handlers/operations/last/[workdayId]';
import handler_19 from './handlers/park-state';
import handler_20 from './handlers/send-checklist';
import handler_21 from './handlers/settings/logo';
import handler_22 from './handlers/settings/telegram/test';
import handler_23 from './handlers/settings/telegram';
import handler_24 from './handlers/settings/texts';
import handler_25 from './handlers/stock';
import handler_26 from './handlers/system/core-metrics';
import handler_27 from './handlers/system/setup-status';
import handler_28 from './handlers/system/setup';
import handler_29 from './handlers/tanks/all';
import handler_30 from './handlers/tanks/[id]/status';
import handler_31 from './handlers/tanks';
import handler_32 from './handlers/tech-lines/[id]';
import handler_33 from './handlers/tech-lines';
import handler_34 from './handlers/telegram/webhook';
import handler_35 from './handlers/train-report';
import handler_36 from './handlers/trains';
import handler_37 from './handlers/tza/[id]/monitoring';
import handler_38 from './handlers/tza/[id]';
import handler_39 from './handlers/tza';
import handler_40 from './handlers/workdays/close';
import handler_41 from './handlers/workdays/start';
import handler_42 from './handlers/workdays';


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
