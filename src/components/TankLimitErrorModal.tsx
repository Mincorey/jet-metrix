import React from 'react';
import { AlertTriangle, ArrowLeft, X, ShieldAlert, TrendingUp, TrendingDown } from 'lucide-react';
import { TankValidationResult } from '../utils/tankLimits';

interface TankLimitErrorModalProps {
  validation: TankValidationResult | null;
  onClose: () => void;
}

export default function TankLimitErrorModal({ validation, onClose }: TankLimitErrorModalProps) {
  if (!validation || validation.isValid) return null;

  const isOverflow = validation.errorType === 'overflow';

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-md z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-rose-200 dark:border-rose-900/50 flex flex-col max-h-[92vh]">
        
        {/* HEADER WITH PULSING ICON */}
        <div className={`p-6 text-center relative ${
          isOverflow 
            ? 'bg-gradient-to-b from-rose-500/15 via-rose-500/5 to-transparent' 
            : 'bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-transparent'
        }`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-700/60 transition-colors"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mb-3 shadow-inner ring-4 ring-rose-500/10 animate-bounce">
            {isOverflow ? <TrendingUp className="w-8 h-8" /> : <TrendingDown className="w-8 h-8" />}
          </div>

          <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">
            {validation.title || 'Предупреждение по лимиту резервуара'}
          </h3>

          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700/80 text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span>{validation.tankName}</span>
          </div>
        </div>

        {/* CONTENT & METRICS */}
        <div className="p-6 pt-0 space-y-4 overflow-y-auto">
          {/* Explanation Text */}
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/40 text-xs sm:text-sm text-rose-900 dark:text-rose-200 leading-relaxed font-medium">
            {validation.message}
          </div>

          {/* Detailed metrics grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200/70 dark:border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">
                Текущий остаток
              </span>
              <span className="text-base font-bold text-slate-800 dark:text-white font-mono">
                {validation.currentVolume.toLocaleString('ru-RU')} л
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200/70 dark:border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">
                Объем операции
              </span>
              <span className={`text-base font-bold font-mono ${isOverflow ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {isOverflow ? `+${validation.operationVolume.toLocaleString('ru-RU')}` : `-${validation.operationVolume.toLocaleString('ru-RU')}`} л
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200/70 dark:border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">
                {isOverflow ? 'Предел наполнения' : 'Незабираемый остаток'}
              </span>
              <span className="text-base font-bold text-slate-700 dark:text-slate-300 font-mono">
                {validation.limitVolume.toLocaleString('ru-RU')} л
              </span>
            </div>

            <div className="p-3 rounded-xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/30">
              <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 tracking-wider block mb-0.5">
                {isOverflow ? 'Превышение на' : 'Дефицит'}
              </span>
              <span className="text-base font-bold text-rose-600 dark:text-rose-400 font-mono">
                {validation.diffVolume.toLocaleString('ru-RU')} л
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Нажмите <b>«К операции»</b>, чтобы вернуться и скорректировать введенные показания.</span>
          </div>
        </div>

        {/* FOOTER ACTION BUTTON */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/80 shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold py-3.5 px-6 rounded-2xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 group"
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            <span>К операции</span>
          </button>
        </div>

      </div>
    </div>
  );
}
