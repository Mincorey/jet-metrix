export interface DailyMeasurementRecord {
    id?: number;
    Workday_ID: number;
    Date: string;
    Name: string;
    Tank_Name: string;
    Level_1: number;
    Level_2: number;
    Level_3: number;
    Average_Level: number;
    Density: number;
    Temperature: number;
    Volume: number;
    Mass: number;
}

export const addDailyMeasurementDB = async (record: Omit<DailyMeasurementRecord, 'id'>) => {
    try {
        const response = await fetch('/api/daily-measurements', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(record)
        });

        const savedRecord = await response.json();
        console.log('✅ Данные успешно отправлены на Сервер:', savedRecord);
        return savedRecord;
    } catch (error) {
        console.error("❌ Ошибка при отправке на Сервер:", error);
        return null;
    }
};

export const getLatestDensityDB = async (tankName: string) => {
    try {
        const response = await fetch(`/api/daily-measurements/latest/${encodeURIComponent(tankName)}`);
        const data = await response.json();
        return data.Density || '';
    } catch (error) {
        console.error("❌ Ошибка при получении последней плотности из БД:", error);
        return '';
    }
};

