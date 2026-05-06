import React, { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';

interface TZA {
  id: number;
  Name: string;
  Volume: number;
  Current_Volume: number;
  Is_Monitoring: number;
}

const TZAMonitorWidget: React.FC = () => {
  const [tzas, setTzas] = useState<TZA[]>([]);

  const fetchTZAs = async () => {
    try {
      const response = await fetch('/api/tza');
      if (response.ok) {
        const data = await response.json();
        setTzas(data);
      }
    } catch (error) {
      console.error("Ошибка при загрузке данных ТЗА:", error);
    }
  };

  useEffect(() => {
    fetchTZAs();
    // Обновляем данные каждые 10 секунд для Real-Time эффекта
    const interval = setInterval(fetchTZAs, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700/50 mb-6 font-sans">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/20 rounded-lg">
          <Truck className="text-blue-400" size={24} />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Уровень топлива в ТЗА (Real-Time)</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-6">
        {tzas.map((tza) => {
          // Если мониторинг выключен, считаем бак полным для визуала, но делаем серым
          const isMonitoring = tza.Is_Monitoring === 1;
          const currentVol = tza.Current_Volume ?? tza.Volume;
          const maxVol = tza.Volume || 1; // Защита от деления на 0
          let percentage = Math.round((currentVol / maxVol) * 100);
          if (percentage < 0) percentage = 0;
          if (percentage > 100) percentage = 100;

          // Логика цветов
          let fillColor = 'bg-slate-500'; // По умолчанию (если выключен)
          if (isMonitoring) {
            if (percentage > 50) fillColor = 'bg-emerald-500';
            else if (percentage > 20) fillColor = 'bg-amber-500';
            else fillColor = 'bg-red-500';
          }

          return (
            <div key={tza.id} className="flex flex-col items-center bg-slate-50 dark:bg-slate-700/30 p-2 sm:p-4 rounded-xl text-center w-full overflow-hidden">
              <div className="text-lg font-bold text-slate-800 dark:text-white mb-1">ТЗА-{tza.Name}</div>
              <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-3 text-center">
                {isMonitoring ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex flex-col xl:flex-row items-center justify-center gap-1 leading-tight">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span> 
                    <span>Мониторинг активен</span>
                  </span>
                ) : (
                  <span className="text-slate-500">Мониторинг отключен</span>
                )}
              </div>

              {/* Вертикальная "Батарейка" / Цистерна */}
              <div className="relative w-16 sm:w-24 h-36 sm:h-48 bg-slate-200 dark:bg-slate-800 rounded-2xl border-4 border-slate-300 dark:border-slate-600 overflow-hidden shadow-inner mb-3 flex items-end shrink-0">
                <div 
                  className={`w-full transition-all duration-1000 ease-in-out ${fillColor}`}
                  style={{ height: `${percentage}%` }}
                >
                  <div className="absolute top-0 left-0 w-full h-2 bg-black/10 dark:bg-white/20"></div>
                </div>
                {/* Отметки процентов (декоративные) */}
                <div className="absolute inset-y-0 left-0 flex flex-col justify-between py-6 pl-2 pointer-events-none opacity-50 z-10">
                  <div className="border-b-[1.5px] border-slate-500 dark:border-white/60 w-3 rounded-full"></div>
                  <div className="border-b-[1.5px] border-slate-400 dark:border-white/40 w-1.5 rounded-full"></div>
                  <div className="border-b-[1.5px] border-slate-500 dark:border-white/60 w-3 rounded-full"></div>
                  <div className="border-b-[1.5px] border-slate-400 dark:border-white/40 w-1.5 rounded-full"></div>
                  <div className="border-b-[1.5px] border-slate-500 dark:border-white/60 w-3 rounded-full"></div>
                </div>
              </div>

              {/* Цифры под бочкой */}
              <div className="text-center w-full px-1 overflow-hidden">
                <div className="text-base sm:text-xl font-bold text-slate-800 dark:text-white whitespace-nowrap">
                  {currentVol.toLocaleString('ru-RU')} <span className="text-xs text-slate-400 font-normal">л</span>
                </div>
                <div className="text-[10px] sm:text-xs text-slate-400 whitespace-nowrap">
                  из {maxVol.toLocaleString('ru-RU')} л ({percentage}%)
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TZAMonitorWidget;
