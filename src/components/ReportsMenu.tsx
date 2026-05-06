import React from 'react';
import { WorkdayRecord } from '../data/WORKDAY';

interface ReportsMenuProps {
  currentWorkday: WorkdayRecord | null;
  onBack: () => void;
  onNavigate: (reportType: string) => void;
}

export default function ReportsMenu({ currentWorkday, onBack, onNavigate }: ReportsMenuProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col items-center py-12 px-4 font-sans transition-colors duration-200">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100 mb-2">
            Отчеты и Журналы
          </h1>
          {currentWorkday ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium mb-1">Текущая смена</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{currentWorkday.Name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{currentWorkday.Date}</p>
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-900/30 mb-6">
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Смена не открыта</p>
            </div>
          )}
        </div>

        <div className="h-px bg-slate-200 dark:bg-slate-700 w-full mb-8"></div>

        <div className="space-y-3">
          <button
            onClick={() => onNavigate('stock')}
            className="w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-base font-semibold py-5 px-5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-between"
          >
            <span>Остатки на складе</span>
            <span className="text-slate-400 dark:text-slate-500">→</span>
          </button>

          <button
            onClick={() => onNavigate('reception')}
            className="w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-base font-semibold py-5 px-5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-between"
          >
            <span>Отчет по приему топлива</span>
            <span className="text-slate-400 dark:text-slate-500">→</span>
          </button>

          <button
            onClick={() => onNavigate('reception-auto')}
            className="w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-base font-semibold py-5 px-5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-between"
          >
            <span>Отчет по приему из АЦ</span>
            <span className="text-slate-400 dark:text-slate-500">→</span>
          </button>

          <button
            onClick={() => onNavigate('dispensing-tza')}
            className="w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-base font-semibold py-5 px-5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-between"
          >
            <span>Отчет по выдаче в ТЗА</span>
            <span className="text-slate-400 dark:text-slate-500">→</span>
          </button>

          <button
            onClick={() => onNavigate('dispensing-vs')}
            className="w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-base font-semibold py-5 px-5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-between"
          >
            <span>Отчет по выдаче в ВС</span>
            <span className="text-slate-400 dark:text-slate-500">→</span>
          </button>

          <button
            onClick={() => onNavigate('train-report')}
            className="w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-base font-semibold py-5 px-5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-between"
          >
            <span>Отчет по ЖДЦ</span>
            <span className="text-slate-400 dark:text-slate-500">→</span>
          </button>

          <button
            onClick={() => onNavigate('shift')}
            className="w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-base font-semibold py-5 px-5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-between"
          >
            <span>Сменный отчет</span>
            <span className="text-slate-400 dark:text-slate-500">→</span>
          </button>

          <button
            onClick={onBack}
            className="w-full py-4 mt-8 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium rounded-2xl transition-colors"
          >
            Назад
          </button>
        </div>
      </div>
    </div>
  );
}
