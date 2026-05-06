export interface TrainRecord {
  id: number;
  Date: string;
  Name: string;
  Number: string;
  Type: string;
  Level_1: number;
  Level_2: number;
  Level_3: number;
  Average_Level: number;
  Density: number;
  Temperature: number;
  Volume: number;
  Mass: number;
}

export const trainsTable: TrainRecord[] = [];

export const addTrainRecord = (record: Omit<TrainRecord, 'id'>): TrainRecord => {
  const newId = trainsTable.length > 0 ? Math.max(...trainsTable.map(r => r.id)) + 1 : 1;
  const newRecord = { ...record, id: newId };
  trainsTable.push(newRecord);
  return newRecord;
};
