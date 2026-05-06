// Описание структуры данных (добавили Workday_ID для связи со сменой)
export interface FuelReceptionRecord {
  id?: number;
  Workday_ID: number;
  Date: string;
  Name: string;
  Tank_Name: string;
  Counter_Before: number;
  Counter_After: number;
  Density: number;
  Volume: number;
  Mass: number;
}

// Временно оставляем локальный массив для совместимости старого кода
export const fuelReceptionTable: FuelReceptionRecord[] = [];

// 🚀 НОВАЯ ФУНКЦИЯ: Отправляем акт приема топлива на Сервер
export const addFuelReceptionRecordDB = async (record: Omit<FuelReceptionRecord, 'id'>) => {
  try {
    const response = await fetch('/api/fuel-reception', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(record)
    });

    const savedRecord = await response.json();
    console.log('✅ Пользователь успешно отправил данные на Сервер:', savedRecord);
    return savedRecord;
  } catch (error) {
    console.error("❌ Ошибка Пользователя при отправке на Сервер:", error);
    return null;
  }
};