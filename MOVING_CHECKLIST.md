# Чек-лист переноса проекта JetMetrix на новый хостинг (MOVING_CHECKLIST.md)

В данном файле фиксируются все требования, переменные окружения, настройки доменов, внешних сервисов и особенности конфигурации, необходимые для успешного развертывания проекта на новом хостинге / сервере.

---

## 1. Переменные окружения (Environment Variables)

При развертывании проекта (на Vercel, VPS или другом PaaS/сервере) необходимо задать следующие переменные окружения:

| Переменная | Назначение | Пример / Примечание |
|---|---|---|
| `SUPABASE_URL` | URL базы данных Supabase проекта | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Сервисный секретный ключ доступа к Supabase (Service Role Key) с полными правами | `eyJhbGciOi...` (из Dashboard → Project Settings → API) |
| `SMTP_USER` | Логин почтового ящика для отправки чек-листов (Yandex) | `JetMetrix@yandex.ru` |
| `SMTP_PASS` | Пароль приложения для SMTP почты | пароль приложения из Яндекс ID |
| `SMTP_TO` | Email получателя отчетов/чек-листов | `oantonov@infradevelop.ru` |
| `GEMINI_API_KEY` | *(Опционально)* Ключ к Google Gemini API | используется при включении функций ИИ |

---

## 2. Конфигурация сервера и маршрутизации (Vercel / Nginx)

1. **Фронтенд (SPA)**:
   - Сборка фронтенда: `npm run build`
   - Каталог сборки (output directory): `dist`
   - Все запросы страниц (кроме `/api/*` и статики) должны перенаправляться на `/index.html` (SPA fallback).
2. **Бэкенд (Serverless / API Routes)**:
   - В текущей архитектуре API реализован через серверлесс-функцию `api/[...path].ts` (конфигурация в [vercel.json](file:///c:/PROJECTS/JET-METRIX/vercel.json)).
   - При переносе на VPS с Node.js/Express потребуется использовать адаптер или standalone-сервер для обработки маршрутов `api/*`.
3. **Cron-задачи**:
   - В `vercel.json` настроена регулярная задача:
     - Маршрут: `/api/system/auto-close-shift`
     - Расписание: `0 0 * * *` (ежедневно в полночь).
   - При переносе на новый сервер настроить аналогичный cron (crontab на Linux или Cloud Scheduler).

---

## 3. База данных (Supabase / PostgreSQL)

- Схема базы данных хранится в [supabase/schema.sql](file:///c:/PROJECTS/JET-METRIX/supabase/schema.sql).
- Основные таблицы:
  - `Tanks_Directory` (каталог резервуаров, калибровочные таблицы)
  - `Daily_Measurements` (замеры топлива: объемы, массы, средний взлив `Average_Level`, плотность, температура)
  - `Fuel_Reception`, `Fuel_Reception_Auto` (прием топлива)
  - `Fuel_Dispensing_TZA`, `Fuel_Dispensing_VS` (выдача топлива)
  - `In_warehouse` (внутрискладские перекачки)
  - `Workdays` (рабочие смены)
  - `Settings` (настройки Telegram-бота, системные параметры)
- При переносе на новый инстанс Supabase/Postgres накатить `schema.sql` и проверить доступность таблиц.

---

## 4. Telegram-бот и Webhook

- Токен бота и ID чатов хранятся в таблице `Settings`:
  - `telegram_bot_token`
  - `telegram_chat_ids`
- Webhook Telegram направляется на URL:
  `https://<ваш-домен>/api/telegram/webhook`
- При смене домена необходимо обновить адрес вебхука через Telegram Bot API:
  `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<НОВЫЙ_ДОМЕН>/api/telegram/webhook`

---

## 5. Заметки по изменениям функционала

- **18.09.2026 (Карта резервуарного парка)**:
  - В `/api/park-state` добавлена выгрузка среднего взлива (`Average_Level` и `Date` из `Daily_Measurements`). Новых переменных окружения не требуется, задействована существующая таблица БД.
