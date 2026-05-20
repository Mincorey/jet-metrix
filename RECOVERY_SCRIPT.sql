-- ============================================
-- СКРИПТ ВОССТАНОВЛЕНИЯ ПОТЕРЯННЫХ ДАННЫХ
-- ============================================
-- Дата: 20.05.2026
-- Проблема: Операции записаны с неправильным Workday_ID
--
-- ВАЖНО: Прежде чем запустить этот скрипт:
-- 1. Создайте резервную копию БД
-- 2. Проверьте, что это правильные операции
-- 3. Выполняйте поэтапно, проверяя результаты каждого шага

-- ============================================
-- ЭТАП 1: ДИАГНОСТИКА
-- ============================================

-- 1.1 Посмотреть все операции ТЗА с неправильным Workday_ID
SELECT 'TZA_ORPHANED' as type, * FROM Fuel_Dispensing_TZA
WHERE Workday_ID IN (2, 6, 14, 21, 29, 36, 44)
ORDER BY Date DESC;

-- 1.2 Посмотреть все операции ВС с неправильным Workday_ID
SELECT 'VS_ORPHANED' as type, * FROM Fuel_Dispensing_VS
WHERE Workday_ID IN (2, 14, 21, 29, 43)
ORDER BY Date DESC;

-- 1.3 Проверить, существуют ли закрытые смены для этих дат
SELECT DISTINCT
  op.Date,
  op.Workday_ID as wrong_id,
  w.id as correct_id,
  w.Workday_Status
FROM Fuel_Dispensing_TZA op
LEFT JOIN Workdays w ON op.Date = w.Date
WHERE op.Workday_ID IN (2, 6, 14, 21, 29, 36, 44)
ORDER BY op.Date DESC;

-- 1.4 Аналогично для ВС
SELECT DISTINCT
  op.Date,
  op.Workday_ID as wrong_id,
  w.id as correct_id,
  w.Workday_Status
FROM Fuel_Dispensing_VS op
LEFT JOIN Workdays w ON op.Date = w.Date
WHERE op.Workday_ID IN (2, 14, 21, 29, 43)
ORDER BY op.Date DESC;

-- ============================================
-- ЭТАП 2: ОТОБРАЖЕНИЕ ПОТЕРЯННЫХ ОПЕРАЦИЙ
-- ============================================

-- 2.1 Все потерянные операции ТЗА с их суммами
SELECT
  Workday_ID,
  COUNT(*) as count_operations,
  SUM(Volume) as total_volume,
  SUM(Mass) as total_mass,
  MIN(Date) as first_date,
  MAX(Date) as last_date
FROM Fuel_Dispensing_TZA
WHERE Workday_ID IN (2, 6, 14, 21, 29, 36, 44)
GROUP BY Workday_ID
ORDER BY Workday_ID;

-- 2.2 Все потерянные операции ВС с их суммами
SELECT
  Workday_ID,
  COUNT(*) as count_operations,
  SUM(Volume) as total_volume,
  SUM(Mass) as total_mass,
  MIN(Date) as first_date,
  MAX(Date) as last_date
FROM Fuel_Dispensing_VS
WHERE Workday_ID IN (2, 14, 21, 29, 43)
GROUP BY Workday_ID
ORDER BY Workday_ID;

-- ============================================
-- ЭТАП 3: ВОССТАНОВЛЕНИЕ ДАННЫХ
-- ============================================

-- ⚠️ ВНИМАНИЕ: Следующие команды UPDATE изменят данные!
--    Убедитесь, что проверили ЭТАП 1 и ЭТАП 2!

-- 3.1 Обновить Fuel_Dispensing_TZA
UPDATE Fuel_Dispensing_TZA
SET Workday_ID = (
  SELECT id FROM Workdays
  WHERE Date = Fuel_Dispensing_TZA.Date
  AND Workday_Status = 'Closed'
  LIMIT 1
)
WHERE Workday_ID IN (2, 6, 14, 21, 29, 36, 44)
AND EXISTS (
  SELECT 1 FROM Workdays w
  WHERE w.Date = Fuel_Dispensing_TZA.Date
  AND w.Workday_Status = 'Closed'
);

-- 3.2 Обновить Fuel_Dispensing_VS
UPDATE Fuel_Dispensing_VS
SET Workday_ID = (
  SELECT id FROM Workdays
  WHERE Date = Fuel_Dispensing_VS.Date
  AND Workday_Status = 'Closed'
  LIMIT 1
)
WHERE Workday_ID IN (2, 14, 21, 29, 43)
AND EXISTS (
  SELECT 1 FROM Workdays w
  WHERE w.Date = Fuel_Dispensing_VS.Date
  AND w.Workday_Status = 'Closed'
);

-- ============================================
-- ЭТАП 4: ПЕРЕСЧИТАТЬ АГРЕГАТЫ
-- ============================================

-- 4.1 Пересчитать агрегаты для всех затронутых смен
UPDATE Workdays SET
  Fuel_Issued_TZA_L = COALESCE((
    SELECT SUM(Volume) FROM Fuel_Dispensing_TZA
    WHERE Workday_ID = Workdays.id
  ), 0),
  Fuel_Issued_TZA_KG = COALESCE((
    SELECT SUM(Mass) FROM Fuel_Dispensing_TZA
    WHERE Workday_ID = Workdays.id
  ), 0),
  Fuel_Issued_VS_L = COALESCE((
    SELECT SUM(Volume) FROM Fuel_Dispensing_VS
    WHERE Workday_ID = Workdays.id
  ), 0),
  Fuel_Issued_VS_KG = COALESCE((
    SELECT SUM(Mass) FROM Fuel_Dispensing_VS
    WHERE Workday_ID = Workdays.id
  ), 0)
WHERE id IN (
  SELECT DISTINCT Workday_ID FROM Fuel_Dispensing_TZA
  WHERE Date IN ('19.05.2026', '18.05.2026', '17.05.2026')
)
OR id IN (
  SELECT DISTINCT Workday_ID FROM Fuel_Dispensing_VS
  WHERE Date IN ('19.05.2026', '18.05.2026', '17.05.2026')
);

-- ============================================
-- ЭТАП 5: ПРОВЕРКА РЕЗУЛЬТАТОВ
-- ============================================

-- 5.1 Проверить, что операции ТЗА теперь имеют правильный Workday_ID
SELECT * FROM Fuel_Dispensing_TZA
WHERE Date IN ('19.05.2026', '18.05.2026', '17.05.2026')
ORDER BY Date DESC, id DESC;

-- 5.2 Проверить, что операции ВС теперь имеют правильный Workday_ID
SELECT * FROM Fuel_Dispensing_VS
WHERE Date IN ('19.05.2026', '18.05.2026', '17.05.2026')
ORDER BY Date DESC, id DESC;

-- 5.3 Проверить, что смены теперь имеют правильные агрегаты
SELECT
  id,
  Date,
  Name,
  Fuel_Issued_TZA_L,
  Fuel_Issued_TZA_KG,
  Fuel_Issued_VS_L,
  Fuel_Issued_VS_KG,
  Workday_Status
FROM Workdays
WHERE Date IN ('19.05.2026', '18.05.2026', '17.05.2026')
ORDER BY Date DESC, id DESC;

-- ============================================
-- ЭТАП 6: ИТОГОВЫЙ ОТЧЕТ
-- ============================================

-- 6.1 Сравнение до/после по дате 19.05.2026
SELECT
  w.id,
  w.Date,
  w.Name,
  w.Workday_Status,
  COALESCE((SELECT SUM(Volume) FROM Fuel_Dispensing_TZA WHERE Workday_ID = w.id), 0) as calculated_tza_l,
  w.Fuel_Issued_TZA_L as stored_tza_l,
  COALESCE((SELECT SUM(Mass) FROM Fuel_Dispensing_TZA WHERE Workday_ID = w.id), 0) as calculated_tza_kg,
  w.Fuel_Issued_TZA_KG as stored_tza_kg,
  COALESCE((SELECT SUM(Volume) FROM Fuel_Dispensing_VS WHERE Workday_ID = w.id), 0) as calculated_vs_l,
  w.Fuel_Issued_VS_L as stored_vs_l,
  COALESCE((SELECT SUM(Mass) FROM Fuel_Dispensing_VS WHERE Workday_ID = w.id), 0) as calculated_vs_kg,
  w.Fuel_Issued_VS_KG as stored_vs_kg
FROM Workdays w
WHERE w.Date IN ('19.05.2026', '18.05.2026')
ORDER BY w.Date DESC, w.id DESC;

-- ============================================
-- ПРИМЕЧАНИЯ
-- ============================================
--
-- После выполнения этого скрипта:
-- 1. Все операции будут переправлены на правильный Workday_ID
-- 2. Агрегированные значения в таблице Workdays будут пересчитаны
-- 3. ShiftReport должен показывать правильные значения
-- 4. Все отчеты (операционные и сменные) должны быть согласованы
--
-- Если что-то пошло не так:
-- 1. Восстановите БД из резервной копии
-- 2. Проверьте, что даты операций совпадают с датами закрытых смен
-- 3. Проверьте, нет ли открытых смен на эту дату (они должны быть закрыты)
--
-- ============================================
