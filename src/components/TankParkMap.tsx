import React, { useState, useEffect } from 'react';
import { ChevronLeft, X, Info, Thermometer, Droplets, Database, ArrowLeft } from 'lucide-react';

interface TankData {
  name: string;
  volume: number;
  mass: number;
  maxCapacity: number;
  density: number;
  temperature: number;
}

interface TankParkMapProps {
  onBack: () => void;
}

const TankParkMap: React.FC<TankParkMapProps> = ({ onBack }) => {
  const [tanks, setTanks] = useState<TankData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTank, setSelectedTank] = useState<TankData | null>(null);

  const fetchParkState = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/park-state`);
      if (response.ok) {
        const data = await response.json();
        setTanks(data);
      }
    } catch (error) {
      console.error('Failed to fetch park state:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParkState();
  }, []);

  const rgs50 = tanks.filter(t => t.name.includes('РГС-50'));
  const rgs100 = tanks.filter(t => t.name.includes('РГС-100'));

  const TankCylinder = ({ tank }: { tank: TankData; key?: string }) => {
    const percent = Math.min(Math.round((tank.volume / tank.maxCapacity) * 100), 100);
    const visualPercent = Math.max(0, Math.min(100, percent));
    
    let fillColor = 'bg-emerald-500';
    if (percent < 20) fillColor = 'bg-red-500';
    else if (percent <= 80) fillColor = 'bg-amber-400';

    return (
      <div 
        className="flex flex-col items-center cursor-pointer transition-transform hover:scale-105"
        onClick={() => setSelectedTank(tank)}
      >
        <div className="relative w-24 h-48 sm:h-56 bg-white dark:bg-slate-800 border-4 border-slate-300 dark:border-slate-600 rounded-t-3xl rounded-b-3xl overflow-hidden shadow-inner">
          {/* Уровень жидкости */}
          <div 
            className={`absolute bottom-0 w-full transition-all duration-1000 ease-in-out ${fillColor}`}
            style={{ height: `${visualPercent}%` }}
          />
          
          {/* Наложение данных */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 font-mono drop-shadow-lg text-center p-1 text-slate-900 dark:text-white">
            <span className="text-xl font-bold mb-0.5">{percent}%</span>
            <span className="text-[10px] leading-tight font-bold uppercase tracking-tighter">
              {tank.volume.toLocaleString('ru-RU')} л
            </span>
            <span className="text-[10px] leading-tight font-bold">
              {tank.mass.toLocaleString('ru-RU')} кг
            </span>
          </div>
        </div>
        <span className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-300 tracking-tight">
          {tank.name}
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 pt-14 pb-20 font-sans transition-colors duration-200 flex flex-col">
      <div className="w-full max-w-md mx-auto">
        {/* Header */}
        <div className="w-full mb-8">
          <button 
            onClick={onBack} 
            className="mb-6 flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 px-5 py-2.5 rounded-xl transition-all w-fit font-medium text-sm active:scale-95"
          >
             <ArrowLeft className="w-5 h-5" /> Назад
          </button>
          <div className="text-center w-full">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100 mb-2">Карта резервуарного парка</h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Данные в реальном времени</p>
          </div>
        </div>

        {loading && tanks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
            <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4" />
            <p className="font-medium tracking-widest uppercase text-sm">Синхронизация...</p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* РГС-100 */}
            {rgs100.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-2 h-8 bg-emerald-500 rounded-full" />
                  <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Группа РГС-100</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {rgs100.map(tank => <TankCylinder key={tank.name} tank={tank} />)}
                </div>
              </section>
            )}

            {/* РГС-50 */}
            {rgs50.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-2 h-8 bg-amber-400 rounded-full" />
                  <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Группа РГС-50</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {rgs50.map(tank => <TankCylinder key={tank.name} tank={tank} />)}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Modal */}
        {selectedTank && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl border border-white/20">
              {/* Modal Header */}
              <div className="p-6 pb-0 flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{selectedTank.name}</h3>
                </div>
                <button 
                  onClick={() => setSelectedTank(null)}
                  className="p-2 bg-slate-100 dark:bg-slate-700 rounded-2xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Объем</p>
                    <p className="text-lg font-mono font-bold text-slate-700 dark:text-slate-200">{selectedTank.volume.toLocaleString('ru-RU')} л</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Масса</p>
                    <p className="text-lg font-mono font-bold text-slate-700 dark:text-slate-200">{selectedTank.mass.toLocaleString('ru-RU')} кг</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                    <Thermometer className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Температура</p>
                      <p className="text-base font-bold text-slate-700 dark:text-slate-200">{selectedTank.temperature} °C</p>
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                    <Droplets className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Плотность</p>
                      <p className="text-base font-bold text-slate-700 dark:text-slate-200">{selectedTank.density}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-3xl border border-emerald-100 dark:border-emerald-800 flex items-start gap-4">
                  <Database className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mt-1" />
                  <div>
                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-1">Свободный объем</p>
                    <p className="text-sm text-emerald-700/80 dark:text-emerald-400/80 leading-relaxed font-medium">
                      Можно долить еще <span className="text-lg font-bold text-emerald-600 dark:text-emerald-300">{(selectedTank.maxCapacity - selectedTank.volume).toLocaleString('ru-RU')}</span> литров до полного объема.
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedTank(null)}
                  className="w-full bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg active:scale-95"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Дублирующая кнопка Назад внизу */}
        <div className="w-full mt-12 flex justify-center">
          <button 
            onClick={onBack} 
            className="w-full sm:w-64 py-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-lg font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-6 h-6" /> Назад
          </button>
        </div>
      </div>
    </div>
  );
};

export default TankParkMap;
