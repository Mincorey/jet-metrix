import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withCors, sendError } from './_lib/helpers'

import handler_0 from './_routes/backup';
import handler_1 from './_routes/daily-measurements/latest/[tankName]';
import handler_2 from './_routes/daily-measurements';
import handler_3 from './_routes/dashboard/activity';
import handler_4 from './_routes/dashboard/summary';
import handler_5 from './_routes/dashboard/timeline/[workdayId]';
import handler_6 from './_routes/database/clear-operations';
import handler_7 from './_routes/employees/all';
import handler_8 from './_routes/employees/[id]/status';
import handler_9 from './_routes/employees/[id]';
import handler_10 from './_routes/employees';
import handler_11 from './_routes/fuel-dispensing-tza';
import handler_12 from './_routes/fuel-dispensing-vs';
import handler_13 from './_routes/fuel-reception-auto';
import handler_14 from './_routes/fuel-reception';
import handler_15 from './_routes/in-warehouse';
import handler_16 from './_routes/inventory';
import handler_17 from './_routes/operations/edit-last';
import handler_18 from './_routes/operations/last/[workdayId]';
import handler_19 from './_routes/park-state';
import handler_20 from './_routes/send-checklist';
import handler_21 from './_routes/settings/logo';
import handler_22 from './_routes/settings/telegram/test';
import handler_23 from './_routes/settings/telegram';
import handler_24 from './_routes/settings/texts';
import handler_25 from './_routes/stock';
import handler_26 from './_routes/system/core-metrics';
import handler_27 from './_routes/system/setup-status';
import handler_28 from './_routes/system/setup';
import handler_29 from './_routes/tanks/all';
import handler_30 from './_routes/tanks/[id]/status';
import handler_31 from './_routes/tanks';
import handler_32 from './_routes/tech-lines/[id]';
import handler_33 from './_routes/tech-lines';
import handler_34 from './_routes/telegram/webhook';
import handler_35 from './_routes/train-report';
import handler_36 from './_routes/trains';
import handler_37 from './_routes/tza/[id]/monitoring';
import handler_38 from './_routes/tza/[id]';
import handler_39 from './_routes/tza';
import handler_40 from './_routes/workdays/close';
import handler_41 from './_routes/workdays/start';
import handler_42 from './_routes/workdays';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Глобально обрабатываем CORS для всех API-запросов
  if (withCors(req, res)) return;

  const pathArray = req.query.path as string[] || [];
  const route = pathArray.join('/');

  try {
    if (route === 'backup') return await handler_0(req, res);
    if (route === 'daily-measurements/latest/[tankName]') return await handler_1(req, res);
    if (route === 'daily-measurements') return await handler_2(req, res);
    if (route === 'dashboard/activity') return await handler_3(req, res);
    if (route === 'dashboard/summary') return await handler_4(req, res);
    if (route === 'dashboard/timeline/[workdayId]') return await handler_5(req, res);
    if (route === 'database/clear-operations') return await handler_6(req, res);
    if (route === 'employees/all') return await handler_7(req, res);
    if (route === 'employees/[id]/status') return await handler_8(req, res);
    if (route === 'employees/[id]') return await handler_9(req, res);
    if (route === 'employees') return await handler_10(req, res);
    if (route === 'fuel-dispensing-tza') return await handler_11(req, res);
    if (route === 'fuel-dispensing-vs') return await handler_12(req, res);
    if (route === 'fuel-reception-auto') return await handler_13(req, res);
    if (route === 'fuel-reception') return await handler_14(req, res);
    if (route === 'in-warehouse') return await handler_15(req, res);
    if (route === 'inventory') return await handler_16(req, res);
    if (route === 'operations/edit-last') return await handler_17(req, res);
    if (route === 'operations/last/[workdayId]') return await handler_18(req, res);
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
    if (route === 'tanks/[id]/status') return await handler_30(req, res);
    if (route === 'tanks') return await handler_31(req, res);
    if (route === 'tech-lines/[id]') return await handler_32(req, res);
    if (route === 'tech-lines') return await handler_33(req, res);
    if (route === 'telegram/webhook') return await handler_34(req, res);
    if (route === 'train-report') return await handler_35(req, res);
    if (route === 'trains') return await handler_36(req, res);
    if (route === 'tza/[id]/monitoring') return await handler_37(req, res);
    if (route === 'tza/[id]') return await handler_38(req, res);
    if (route === 'tza') return await handler_39(req, res);
    if (route === 'workdays/close') return await handler_40(req, res);
    if (route === 'workdays/start') return await handler_41(req, res);
    if (route === 'workdays') return await handler_42(req, res);

    return sendError(res, 404, `Маршрут API /api/${route} не найден`);
  } catch (error) {
    console.error(`Ошибка в обработчике ${route}:`, error);
    return sendError(res, 500, 'Внутренняя ошибка сервера');
  }
}
