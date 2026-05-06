export interface InventoryRecord {
  id: number;
  date: string;
  Tank_name: string;
  Level_1: number;
  Level_2: number;
  Level_3: number;
  Average_Level: number;
  Density: number;
  Temperature: number;
  Volume: number;
  Mass: number;
}

export const inventoryTable: InventoryRecord[] = [];

export const Volume_TZA_173 = 20320.00;
export const Volume_TZA_174 = 19820.00;
export const Volume_UZVS = 1225.80;

export const addInventoryRecord = (record: Omit<InventoryRecord, 'id'>) => {
  const newRecord = {
    ...record,
    id: inventoryTable.length > 0 ? Math.max(...inventoryTable.map(r => r.id)) + 1 : 1,
  };
  inventoryTable.push(newRecord);
  console.log('Добавлена запись инвентаризации:', newRecord);
  return newRecord;
};

export const getInventoryByMonth = (month: number, year: number) => {
  return inventoryTable.filter(record => {
    const [day, recordMonth, recordYear] = record.date.split('.').map(Number);
    return recordMonth === month && recordYear === year;
  });
};
