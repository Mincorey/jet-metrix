export interface RGSRecord {
  id: number; // Порядковый номер записи
  Date: string; // Дата внесения записи: формат dd.mm.yyyy
  Tank_Name: string; // Имя резервуара
  Level_1: number; // Замер топлива №1: целое число без плавающей точки
  Level_2: number; // Замер топлива №2: целое число без плавающей точки
  Level_3: number; // Замер топлива №3: целое число без плавающей точки
  Average_Level: number; // Среднее арифметическое значение уровня, без знаков после запятой: (Level_1 + Level_2 + Level_3)/3
  Density: number; // Плотность топлива: формат 0.0000
  Temperature: number; // Температура топлива в резервуаре: формат 00.0 или 0.0
  Volume: number; // Объем топлива в резервуаре: формат числовой с 2 знаками после запятой
  Mass: number; // Масса (вес) топлива в резервуаре: формат числовой с 2 знаками после запятой. (Volume * Density)
}

// Имитация таблицы базы данных замеров резервуаров
export const rgsData: RGSRecord[] = [];

/**
 * Функция для добавления новой записи о замере резервуара.
 * Автоматически рассчитывает Average_Level и Mass на основе переданных данных.
 */
export const addRGSRecord = (
  date: string,
  tankName: string,
  level1: number,
  level2: number,
  level3: number,
  density: number,
  temperature: number,
  volume: number
): RGSRecord => {
  // Расчет среднего уровня (округление до целого числа)
  const averageLevel = Math.round((level1 + level2 + level3) / 3);
  
  // Расчет массы (объем * плотность)
  const mass = volume * density;

  const newRecord: RGSRecord = {
    id: rgsData.length > 0 ? Math.max(...rgsData.map(r => r.id)) + 1 : 1,
    Date: date,
    Tank_Name: tankName,
    Level_1: Math.round(level1),
    Level_2: Math.round(level2),
    Level_3: Math.round(level3),
    Average_Level: averageLevel,
    // Используем Number() и toFixed() для форматирования значений при выводе/сохранении
    Density: Number(density.toFixed(4)),
    Temperature: Number(temperature.toFixed(1)),
    Volume: Number(volume.toFixed(2)),
    Mass: Number(mass.toFixed(2)),
  };

  rgsData.push(newRecord);
  console.log('Добавлена новая запись замера резервуара:', newRecord);
  return newRecord;
};
