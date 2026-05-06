export interface RGSMeasurement {
  id: number;
  Date: string; // Формат: dd.mm.yyyy
  Level_1: number; // Замер 1 (целое число)
  Level_2: number; // Замер 2 (целое число)
  Level_3: number; // Замер 3 (целое число)
  Average_Level: number; // Среднее арифметическое (целое число)
  Density: number; // Плотность (формат 0.0000)
  Temperature: number; // Температура (формат 00.0)
  Volume: number; // Объем (2 знака после запятой)
  Mass: number; // Масса (2 знака после запятой)
}

export interface RKMeasurement {
  id: number;
  Date: string; // Формат: dd.mm.yyyy
  Level: number; // Замер (целое число)
  Density: number; // Плотность (формат 0.0000)
  Temperature: number; // Температура (формат 00.0)
  Volume: number; // Объем (2 знака после запятой)
  Mass: number; // Масса (2 знака после запятой)
}
