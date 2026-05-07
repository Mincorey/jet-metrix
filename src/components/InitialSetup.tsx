import React, { useState } from 'react';
import { ShieldCheck, User, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface InitialSetupProps {
  onSetupComplete: () => void;
}

export default function InitialSetup({ onSetupComplete }: InitialSetupProps) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();

    // Валидация логина (только буквы и пробелы)
    const loginRegex = /^[A-Za-zА-Яа-яЁё\s.\-]+$/;
    if (!loginRegex.test(login)) {
      showToast('Логин может содержать только буквы и пробелы', 'error');
      return;
    }

    // Валидация пароля (строго 6 цифр)
    const passwordRegex = /^\d{6}$/;
    if (!passwordRegex.test(password)) {
      showToast('Пароль должен состоять ровно из 6 цифр', 'error');
      return;
    }

    setLoading(true);
    try {
      // @ts-ignore
      const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
      const response = await fetch(`${API_BASE}/api/system/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });

      if (response.ok) {
        showToast('Администратор успешно создан!', 'success');
        onSetupComplete();
      } else {
        const data = await response.json();
        showToast(data.error || 'Ошибка при настройке', 'error');
      }
    } catch (error) {
      console.error('Setup error:', error);
      showToast('Ошибка сети при попытке настройки', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center pt-14 pb-20 px-4 z-[9999] overflow-y-auto">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-lg bg-slate-900/50 backdrop-blur-xl border border-white/10 p-8 md:p-12 rounded-[2rem] shadow-2xl relative">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-tr from-emerald-500 to-blue-500 rounded-3xl flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-6 rotate-3">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 tracking-tight mb-3">
            Добро пожаловать в JetMetrix
          </h1>
          <p className="text-slate-400 text-lg">
            Введите логин Администратора и пароль для первоначальной настройки системы
          </p>
        </div>

        <form onSubmit={handleSetup} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400 flex items-center gap-2 ml-1">
              <User className="w-4 h-4" /> Логин администратора
            </label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Иванов И.И."
              className="w-full bg-slate-800/50 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-lg"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400 flex items-center gap-2 ml-1">
              <Lock className="w-4 h-4" /> ПИН-код (6 цифр)
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full bg-slate-800/50 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-lg tracking-[0.5em]"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold py-5 rounded-2xl shadow-xl shadow-emerald-900/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-3 text-xl group mt-8"
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                Завершить настройку
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-slate-500 text-sm mt-8 border-t border-white/5 pt-8">
          Это разовое действие. После создания первого пользователя этот экран более не появится.
        </p>
      </div>
    </div>
  );
}
