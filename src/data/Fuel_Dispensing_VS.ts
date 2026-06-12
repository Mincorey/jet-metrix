export interface FuelDispensingVSRecord {
  id?: number;
  Workday_ID: number;
  Date: string;
  Name: string;
  TZA: string;
  Control_Number: string;
  Counter_Before?: number | null;
  Counter_After?: number | null;
  Density: number;
  Volume: number;
  Mass: number;
}

export const fuelDispensingVSTable: FuelDispensingVSRecord[] = [];

export const addFuelDispensingVSRecord = (record: Omit<FuelDispensingVSRecord, 'id'>): FuelDispensingVSRecord => {
  const newId = fuelDispensingVSTable.length > 0 ? Math.max(...fuelDispensingVSTable.map(r => (r.id as number))) + 1 : 1;
  const newRecord = { ...record, id: newId };
  fuelDispensingVSTable.push(newRecord);
  return newRecord;
};

// 🚀 НОВАЯ ФУНКЦИЯ: Отправляем заправку ВС на Сервер
export const addFuelDispensingVSDB = async (record: Omit<FuelDispensingVSRecord, 'id'>) => {
  try {
    const response = await fetch('/api/fuel-dispensing-vs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(record)
    });

    const savedRecord = await response.json();
    console.log('✅ Пользователь успешно отправил данные заправки ВС на Сервер:', savedRecord);
    return savedRecord;
  } catch (error) {
    console.error("❌ Ошибка Пользователя при отправке заправки ВС на Сервер:", error);
    return null;
  }
};

