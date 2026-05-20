export interface WorkdayRecord {
  id: number;
  Date: string;
  Name: string;
  Fuel_Received_L?: number;
  Fuel_Received_KG?: number;
  Fuel_Issued_TZA_L?: number;
  Fuel_Issued_TZA_KG?: number;
  Fuel_Issued_VS_L?: number;
  Fuel_Issued_VS_KG?: number;
  Workday_Status?: string;
  Checklist_Sent?: number;
}

// Локальное хранилище (временно оставляем для старых функций закрытия смены)
export let workdayData: WorkdayRecord[] = [];

// 🚀 Загрузить открытые смены из БД (вызывать при инициализации приложения)
export const loadOpenWorkdaysFromDB = async (): Promise<WorkdayRecord[]> => {
  try {
    const response = await fetch('/api/workdays');
    const allWorkdays: WorkdayRecord[] = await response.json();

    // Фильтруем только открытые смены
    const openWorkdays = allWorkdays.filter(w => w.Workday_Status === 'Open');

    // Обновляем локальный массив с открытыми сменами из БД
    workdayData = openWorkdays;

    console.log(`✅ Загружено ${openWorkdays.length} открытых смен из БД`);
    return openWorkdays;
  } catch (error) {
    console.error("❌ Ошибка при загрузке открытых смен из БД:", error);
    return [];
  }
};

// 🚀 НОВАЯ ФУНКЦИЯ: Звоним Диспетчеру, чтобы он открыл смену в БД
export const openWorkdayDB = async (name: string): Promise<WorkdayRecord | null> => {
  try {
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;

    const response = await fetch('/api/workdays/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ Date: formattedDate, Name: name })
    });

    const newWorkday = await response.json();

    // Временно кладем ответ и в старый массив, чтобы Планшет не потерял смену до перезагрузки
    workdayData.push({ ...newWorkday, Workday_Status: 'Open' });
    return newWorkday;
  } catch (error) {
    console.error("❌ Ошибка при открытии смены в БД:", error);
    return null;
  }
};

// --- СТАРЫЕ ФУНКЦИИ --- 
// (Пока не трогаем их, переведем на базу данных чуть позже)

export const closeWorkdayDB = async (id: number) => {
  try {
    const response = await fetch('/api/workdays/close', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id })
    });
    const result = await response.json();
    console.log('✅ Смена успешно закрыта на Сервере:', result);

    // update local state to mirror DB logic (optional safety step for the old ui references)
    const index = workdayData.findIndex(w => w.id === id);
    if (index !== -1) {
      workdayData[index] = { ...workdayData[index], Workday_Status: 'Closed' };
    }

    return result;
  } catch (error) {
    console.error("❌ Ошибка при закрытии смены на Сервере:", error);
    return null;
  }
};

export const deleteWorkday = (id: number) => {
  workdayData = workdayData.filter(w => w.id !== id);
};

export const getOpenWorkday = () => {
  return workdayData.find(w => w.Workday_Status !== 'Closed') || null;
};