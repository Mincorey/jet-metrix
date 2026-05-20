# 📋 АНАЛИЗ СТРУКТУРЫ ОТЧЕТОВ И РЕКОМЕНДАЦИИ

**Дата:** 20.05.2026  
**Анализ:** Проверка логики фильтрации всех отчетов на предмет уязвимости к потере данных

---

## 🔍 ТЕКУЩЕЕ СОСТОЯНИЕ ОТЧЕТОВ

### ✅ ОТЧЕТЫ, ФИЛЬТРУЮЩИЕ ПО ДАТЕ (БЕЗОПАСНЫЕ)

| Отчет | Компонент | Метод фильтрации | Источник данных | Статус |
|-------|-----------|-----------------|-----------------|--------|
| Выдача в ТЗА | FuelDispensingTZAReport.tsx | Фильтр по `record.Date` на фронте | `/api/fuel-dispensing-tza` (все записи) | ✅ БЕЗОПАСНО |
| Выдача в ВС | FuelDispensingVSReport.tsx | Фильтр по `record.Date` на фронте | `/api/fuel-dispensing-vs` (все записи) | ✅ БЕЗОПАСНО |
| Прием топлива | FuelReceptionReport.tsx | Фильтр по дате (первая часть Date) | `/api/fuel-reception` + `/api/fuel-reception-auto` + `/api/in-warehouse` | ✅ БЕЗОПАСНО |
| Учет ЖД-цистерн | TrainMeasurementReport.tsx | Фильтр по `record.Date` на фронте | `/api/train-report` (все записи) | ✅ БЕЗОПАСНО |
| Инвентаризация | InventoryReport.tsx | Фильтр по МЕСЯЦУ из `record.Date` | `/api/inventory` (все записи) | ✅ БЕЗОПАСНО |

### ⚠️ ОТЧЕТ, ЗАВИСЯЩИЙ ОТ WORKDAY_ID (УЯЗВИМЫЙ)

| Отчет | Компонент | Метод фильтрации | Источник данных | Проблема |
|-------|-----------|-----------------|-----------------|----------|
| Сменный отчет | ShiftReport.tsx | Фильтр по дате, но показывает агрегированные данные из Workday | `/api/workdays` (таблица Workdays) | ⚠️ Зависит от правильного Workday_ID операций |

### ℹ️ ДРУГИЕ ОТЧЕТЫ

| Отчет | Компонент | Метод | Статус |
|-------|-----------|-------|--------|
| Остатки топлива | StockReport.tsx | Фильтр по выбранным резервуарам (не по дате) | ✅ Не зависит от операций |

---

## 🎯 ВЫЯВЛЕННАЯ ПРОБЛЕМА

### Почему ShiftReport уязвим:

```
API Endpoint: /api/workdays
↓
Возвращает: Workday records с агрегированными полями:
  - Fuel_Received_L (сумма за смену)
  - Fuel_Issued_TZA_L (сумма за смену)
  - Fuel_Issued_VS_L (сумма за смену)
  - ...и другие

Эти значения ЗАПОЛНЯЮТСЯ ТОЛЬКО при закрытии смены:

api/_handlers/workdays/close.ts:
  - SELECT * FROM Fuel_Dispensing_TZA WHERE Workday_ID = {id}
  - SELECT * FROM Fuel_Dispensing_VS WHERE Workday_ID = {id}
  - Вычисляет SUM() и обновляет Workday запись

ЕСЛИ операции имеют НЕПРАВИЛЬНЫЙ Workday_ID:
  ❌ Они не попадают в SUM()
  ❌ Отчет показывает НУЛИ или НЕПРАВИЛЬНЫЕ СУММЫ
```

### Почему другие отчеты безопасны:

```
FuelDispensingTZAReport.tsx:
  - Получает API response: все операции из таблицы
  - На фронте фильтрует по record.Date
  - ✅ Не зависит от Workday_ID

Пример фильтрации (FuelDispensingTZAReport:43-59):
  const filteredRecords = records.filter(record => {
    const selectedDateStrings = selectedDates.map(date => format(date, 'dd.MM.yyyy'));
    return selectedDateStrings.includes(record.Date);
  });
  // ✅ ЛЮБЫЕ операции с Date = выбранная дата попадут в отчет
  // ✅ Неважно, какой Workday_ID у операции
```

---

## ✅ РЕШЕНИЕ: ВОССТАНОВИТЬ ПОТЕРЯННЫЕ ОТЧЕТЫ

### Шаг 1: Определить правильный Workday_ID

Для каждой операции с неправильным Workday_ID нужно найти правильную смену по дате:

```sql
-- 1. Посмотреть, какие операции потеряны (в БД есть, но Workday_ID неправильный)
SELECT * FROM Fuel_Dispensing_TZA WHERE Workday_ID IN (2, 6, 14, 21, 29, 36, 44);
SELECT * FROM Fuel_Dispensing_VS WHERE Workday_ID IN (2, 14, 21, 29, 43);

-- 2. Для каждой операции определить правильный Workday_ID
-- Пример: операция от 19.05.2026 должна быть привязана к Workday с Date='19.05.2026' и Status='Closed'

SELECT 
  op.id,
  op.Date as operation_date,
  op.Workday_ID as wrong_id,
  w.id as correct_id
FROM Fuel_Dispensing_TZA op
LEFT JOIN Workdays w ON op.Date = w.Date
WHERE op.Workday_ID IN (2, 6, 14, 21, 29, 36, 44)
AND w.Workday_Status = 'Closed';
```

### Шаг 2: Перепривязать операции

```sql
-- Обновить Fuel_Dispensing_TZA
UPDATE Fuel_Dispensing_TZA
SET Workday_ID = (
  SELECT id FROM Workdays 
  WHERE Date = Fuel_Dispensing_TZA.Date 
  AND Workday_Status = 'Closed'
  LIMIT 1
)
WHERE Workday_ID IN (2, 6, 14, 21, 29, 36, 44);

-- Аналогично для Fuel_Dispensing_VS
UPDATE Fuel_Dispensing_VS
SET Workday_ID = (
  SELECT id FROM Workdays 
  WHERE Date = Fuel_Dispensing_VS.Date 
  AND Workday_Status = 'Closed'
  LIMIT 1
)
WHERE Workday_ID IN (2, 14, 21, 29, 43);
```

### Шаг 3: Пересчитать агрегаты для затронутых смен

После обновления операций нужно пересчитать агрегированные значения в таблице Workdays:

```sql
-- Для каждой затронутой смены пересчитать суммы
UPDATE Workdays SET
  Fuel_Issued_TZA_L = (SELECT SUM(Volume) FROM Fuel_Dispensing_TZA WHERE Workday_ID = Workdays.id),
  Fuel_Issued_TZA_KG = (SELECT SUM(Mass) FROM Fuel_Dispensing_TZA WHERE Workday_ID = Workdays.id),
  Fuel_Issued_VS_L = (SELECT SUM(Volume) FROM Fuel_Dispensing_VS WHERE Workday_ID = Workdays.id),
  Fuel_Issued_VS_KG = (SELECT SUM(Mass) FROM Fuel_Dispensing_VS WHERE Workday_ID = Workdays.id)
WHERE id IN (SELECT DISTINCT Workday_ID FROM Fuel_Dispensing_TZA WHERE Workday_ID IN (2, 6, 14, 21, 29, 36, 44))
   OR id IN (SELECT DISTINCT Workday_ID FROM Fuel_Dispensing_VS WHERE Workday_ID IN (2, 14, 21, 29, 43));
```

---

## 🛡️ ПРОФИЛАКТИКА: ДОПОЛНИТЬ ShiftReport

### Рекомендация 1: Добавить режим "По дате" (Date-based aggregation)

Создать дополнительную опцию в ShiftReport, которая показывает агрегированные данные по дате, а не по смене:

```typescript
// Новая функция: агрегировать операции по ДАТЕ
const getDateBasedReport = async (date: string) => {
  const [tza, vs, reception, transfers] = await Promise.all([
    fetch(`/api/fuel-dispensing-tza`).then(r => r.json()),
    fetch(`/api/fuel-dispensing-vs`).then(r => r.json()),
    fetch(`/api/fuel-reception`).then(r => r.json()),
    fetch(`/api/in-warehouse`).then(r => r.json()),
  ]);

  // Фильтруем ВСЕ операции по DATE, НЕЗАВИСИМО от Workday_ID
  const tzaForDate = tza.filter(op => op.Date.startsWith(date));
  const vsForDate = vs.filter(op => op.Date.startsWith(date));
  
  return {
    Fuel_Issued_TZA_L: tzaForDate.reduce((sum, op) => sum + (op.Volume || 0), 0),
    Fuel_Issued_TZA_KG: tzaForDate.reduce((sum, op) => sum + (op.Mass || 0), 0),
    Fuel_Issued_VS_L: vsForDate.reduce((sum, op) => sum + (op.Volume || 0), 0),
    Fuel_Issued_VS_KG: vsForDate.reduce((sum, op) => sum + (op.Mass || 0), 0),
  };
};
```

### Рекомендация 2: Проверить на дублирующиеся смены в один день

Добавить валидацию при открытии смены:

```typescript
export const openWorkdayDB = async (name: string): Promise<WorkdayRecord | null> => {
  const today = new Date();
  const formattedDate = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;

  // 🚀 НОВОЕ: Проверить, нет ли уже открытой смены на эту дату
  const openWorkdaysToday = workdayData.filter(
    w => w.Date === formattedDate && w.Workday_Status === 'Open'
  );

  if (openWorkdaysToday.length > 0) {
    console.warn(`⚠️ На дату ${formattedDate} уже открыта смена!`);
    console.warn(`Существующие смены:`, openWorkdaysToday);
    // Можно вернуть существующую смену или показать предупреждение
    return openWorkdaysToday[0];
  }

  // ... остальной код ...
};
```

---

## 📊 СРАВНЕНИЕ: БЫЛО vs БУДЕТ

### Сценарий: 2 смены открыты в один день (случайно)

#### БЫЛО (конец Workday 46):
```
ShiftReport показывает:
  Сменный отчет за 19.05.2026 (только Workday #46)
  └─ Выдано в ТЗА: 0л ❌ (потому что операции в #44)
  └─ Выдано в ВС: 0л ❌ (потому что операции в #43)

FuelDispensingTZAReport показывает:
  Все операции за 19.05.2026
  └─ Выдано в ТЗА: 14660л ✅ (правильно!)
```

#### БУДЕТ (после восстановления):
```
ShiftReport показывает:
  Сменный отчет за 19.05.2026 (Workday #46)
  └─ Выдано в ТЗА: 14660л ✅
  └─ Выдано в ВС: 7305л ✅

ИЛИ (если пользователь выбирает "По дате"):
  Агрегированный отчет за 19.05.2026 (ВСЕ смены)
  └─ Выдано в ТЗА: 14660л ✅
  └─ Выдано в ВС: 7305л ✅
```

---

## 🚀 ПЛАН ДЕЙСТВИЙ

### Приоритет 1: СРОЧНО (сегодня)
1. ✅ Восстановить потерянные операции (SQL скрипт - готов, см. ниже)
2. ✅ Пересчитать агрегаты для затронутых смен
3. ✅ Проверить, что отчеты снова показывают правильные значения

### Приоритет 2: ВАЖНО (на неделю)
1. ⬜ Добавить режим "По дате" в ShiftReport
2. ⬜ Добавить проверку на дублирующиеся смены
3. ⬜ Добавить логирование для отладки будущих инцидентов

### Приоритет 3: ЖЕЛАТЕЛЬНО (на месяц)
1. ⬜ Рассмотреть миграцию ShiftReport на использование прямой агрегации дат вместо Workday_ID
2. ⬜ Создать автоматизированную проверку консистентности данных

---

## 📝 ИТОГИ

| Аспект | Текущее состояние | Уровень риска | Действие |
|--------|------------------|--------------|----------|
| Операции фильтруются по ДАТЕ | ✅ Большинство отчетов | 🟢 Низкий | Продолжить |
| ShiftReport зависит от Workday_ID | ⚠️ Да | 🔴 Высокий | Восстановить данные + добавить страховку |
| Проверка дублирующихся смен | ❌ Нет | 🟠 Средний | Добавить валидацию |
| Логирование инцидентов | ❌ Минимальное | 🟠 Средний | Расширить |

