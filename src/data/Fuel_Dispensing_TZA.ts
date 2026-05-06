export interface FuelDispensingTZARecord {
  id?: number;
  Workday_ID: number;
  Date: string;
  Name: string;
  TZA: string;
  Tank_Name: string;
  Counter_Before: number;
  Counter_After: number;
  Density: number;
  Volume: number;
  Mass: number;
}

export const fuelDispensingTZATable: FuelDispensingTZARecord[] = [];

export const addFuelDispensingTZARecord = (record: Omit<FuelDispensingTZARecord, 'id'>): FuelDispensingTZARecord => {
  const newId = fuelDispensingTZATable.length > 0 ? Math.max(...fuelDispensingTZATable.map(r => (r.id as number))) + 1 : 1;
  const newRecord = { ...record, id: newId };
  fuelDispensingTZATable.push(newRecord);
  return newRecord;
};

// 🚀 НОВАЯ ФУНКЦИЯ: Отправляем выдачу в ТЗА на Сервер
export const addFuelDispensingTZADB = async (record: Omit<FuelDispensingTZARecord, 'id'>) => {
  try {
    const response = await fetch('/api/fuel-dispensing-tza', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(record)
    });

    const savedRecord = await response.json();
    console.log('✅ Пользователь успешно отправил данные выдачи в ТЗА на Сервер:', savedRecord);
    return savedRecord;
  } catch (error) {
    console.error("❌ Ошибка Пользователя при отправке выдачи в ТЗА на Сервер:", error);
    return null;
  }
};

