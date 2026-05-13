import React, { useState, useEffect } from 'react';
import { domToPng } from 'modern-screenshot';
import { ArrowLeft, TrendingUp, TrendingDown, Clock, Download, Truck, Plane } from 'lucide-react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend, LineChart, Line
} from 'recharts';
import TZAMonitorWidget from './TZAMonitorWidget';

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'year';

interface DashboardProps {
  onBack: () => void;
}

const CustomTankTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-50">
        <p className="font-bold text-slate-800 dark:text-slate-100 mb-2 border-b border-slate-100 dark:border-slate-700 pb-2">{label}</p>
        <div className="space-y-1">
          <p className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">Объем: {data.volume.toLocaleString('ru-RU')} л</p>
          <p className="text-slate-600 dark:text-slate-300 font-medium">Масса: {data.mass.toLocaleString('ru-RU')} кг</p>
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">Макс. вместимость: {data.maxCapacity.toLocaleString('ru-RU')} л</p>
        </div>
      </div>
    );
  }
  return null;
};

export default function Dashboard({ onBack }: DashboardProps) {
  const [period, setPeriod] = useState<Period>('yesterday');
  const [data, setData] = useState<any>(null);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const timeToPercent = (timeStr: string) => {
    if (!timeStr) return 0;
    try {
      const timePart = timeStr.includes(' ') ? timeStr.split(' ')[1] : timeStr;
      const [hours, minutes] = timePart.split(':').map(Number);
      
      if (isNaN(hours) || isNaN(minutes)) return 0;

      const totalMinutes = hours * 60 + minutes;
      const startMinutes = 5 * 60; // 05:00
      const endMinutes = 23 * 60;  // 23:00
      const duration = endMinutes - startMinutes;

      if (duration <= 0) return 0;

      let percent = ((totalMinutes - startMinutes) / duration) * 100;
      percent = Math.max(0, Math.min(100, percent));
      
      return percent;
    } catch (e) {
      console.error('Ошибка парсинга времени:', timeStr);
      return 0;
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard/summary?period=${period}`);

        if (res.ok) {
          const json = await res.json();
          setData(json);

          const activityRes = await fetch('/api/dashboard/activity');
          if (activityRes.ok) {
            const activityJson = await activityRes.json();
            setActivityFeed(activityJson);
          }
          // Load timeline for last open workday
          try {
            const wRes = await fetch('/api/workdays');
            if (wRes.ok) {
              const workdays = await wRes.json();
              if (workdays.length > 0) {
                const latestId = workdays[0].id;
                const tlRes = await fetch(`/api/dashboard/timeline/${latestId}`);
                if (tlRes.ok) { const tlData = await tlRes.json(); console.log('Данные таймлайна получены:', tlData); setTimeline(tlData); }
              }
            }
          } catch (e) { console.error('Timeline load error:', e); }
        } else {
          console.error('Ошибка загрузки дашборда');
        }
      } catch (err) {
        console.error('Ошибка сети:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period]);

  const renderTrend = (value: number) => {
    if (value > 0) {
      return (
        <span className="flex items-center text-emerald-500 text-sm font-medium">
          <TrendingUp className="w-4 h-4 mr-1" />
          +{value}%
        </span>
      );
    }
    if (value < 0) {
      return (
        <span className="flex items-center text-rose-500 text-sm font-medium">
          <TrendingDown className="w-4 h-4 mr-1" />
          {value}%
        </span>
      );
    }
    return <span className="text-slate-500 text-sm font-medium">0%</span>;
  };

  const renderCustomBarLabel = (dataArray: any[]) => (props: any) => {
    const { x, y, width, height, index } = props;
    const tankName = dataArray[index]?.name || '';
    
    const isShort = height < 80; 
    const yPos = isShort ? y - 10 : y + height / 2;
    const textAnchor = isShort ? 'start' : 'middle';
    const fill = isShort ? '#94a3b8' : '#ffffff';

    return (
      <text
        x={x + width / 2}
        y={yPos}
        fill={fill}
        textAnchor={textAnchor}
        dominantBaseline="middle"
        transform={`rotate(-90, ${x + width / 2}, ${yPos})`}
        fontSize={12}
        fontWeight="600"
      >
        {tankName}
      </text>
    );
  };

  const rgs50Balances = data?.charts?.tanksBalances?.filter((t: any) => t.name.includes('РГС-50')) || [];
  const rgs100Balances = data?.charts?.tanksBalances?.filter((t: any) => t.name.includes('РГС-100')) || [];

  const handleDownloadImage = async () => {
    const element = document.getElementById('dashboard-content');
    if (!element) return;

    try {
      // Делаем качественный снимок всего компонента (scale: 2 для Retina-качества)
      const dataUrl = await domToPng(element, {
        scale: 2, 
        backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc',
      });

      // Создаем виртуальную ссылку для скачивания картинки
      const link = document.createElement('a');
      link.download = `Dashboard_JetMetrix_${new Date().toLocaleDateString('ru-RU')}.png`;
      link.href = dataUrl;
      link.click();
      
    } catch (error) {
      console.error('Ошибка при создании скриншота:', error);
    }
  };

  const rgs50MaxDomain = rgs50Balances.length > 0 ? Math.max(...rgs50Balances.map((d: any) => d.maxCapacity)) : 55000;
  const rgs100MaxDomain = rgs100Balances.length > 0 ? Math.max(...rgs100Balances.map((d: any) => d.maxCapacity)) : 110000;

  return (
    <div id="dashboard-content" className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-4 pt-14 pb-20 font-sans w-full max-w-md mx-auto transition-colors duration-200 flex flex-col">
      <button 
        onClick={onBack} 
        className="mb-6 flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 px-5 py-2.5 rounded-xl transition-all w-fit font-medium text-sm active:scale-95"
      >
         <ArrowLeft className="w-5 h-5" /> На главную
      </button>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pdf-section">
        <h1 className="text-2xl font-bold tracking-tight">Аналитический Дашборд</h1>
        
        <button
          onClick={handleDownloadImage}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-50 text-base font-semibold py-3 px-5 rounded-xl transition-all shadow-sm active:scale-95"
        >
          <Download className="w-5 h-5" />
          <span className="inline">Скриншот</span>
        </button>
      </div>

      {/* Period Filter */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 pdf-section">
        {[
          { id: 'yesterday', label: 'Вчера' },
          { id: 'today', label: 'Сегодня' },
          { id: 'week', label: 'Неделя' },
          { id: 'month', label: 'Месяц' },
          { id: 'year', label: 'Год' }
        ].map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id as Period)}
            className={`px-6 py-3 rounded-xl text-base font-semibold transition-colors whitespace-nowrap ${
              period === p.id
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 pdf-section">
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">Загрузка данных...</p>
        </div>
      ) : data ? (
        <>
          {/* KPI Grid */}
          <div className="flex flex-col gap-4 mb-8 pdf-section">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Всего топлива на складе</h3>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {data.kpi.totalFuelKg.toLocaleString('ru-RU')} кг
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{data.kpi.totalFuelL.toLocaleString('ru-RU')} л</p>
            </div>
            
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Принято</h3>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {data.kpi.receivedKg.toLocaleString('ru-RU')} кг
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{data.kpi.receivedL?.toLocaleString('ru-RU') || 0} л</p>
                </div>
                {renderTrend(data.kpi.receivedTrend)}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Выдано</h3>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {data.kpi.dispensedKg.toLocaleString('ru-RU')} кг
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{data.kpi.dispensedL?.toLocaleString('ru-RU') || 0} л</p>
                </div>
                {renderTrend(data.kpi.dispensedTrend)}
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="flex flex-col gap-6 mb-6 pdf-section">
            {/* Chart 1: Остатки РГС-50 */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Остатки РГС-50 (л)</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rgs50Balances} margin={{ top: 30, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={false} dy={10} />
                    <YAxis domain={[0, rgs50MaxDomain]} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} />
                    <Tooltip content={<CustomTankTooltip />} cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="volume" name="Объем (л)" radius={[4, 4, 0, 0]} label={renderCustomBarLabel(rgs50Balances)}>
                      {rgs50Balances.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.fillColor || '#10b981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Остатки РГС-100 */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Остатки РГС-100 (л)</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rgs100Balances} margin={{ top: 30, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={false} dy={10} />
                    <YAxis domain={[0, rgs100MaxDomain]} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} />
                    <Tooltip content={<CustomTankTooltip />} cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="volume" name="Объем (л)" radius={[4, 4, 0, 0]} label={renderCustomBarLabel(rgs100Balances)}>
                      {rgs100Balances.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.fillColor || '#10b981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <TZAMonitorWidget />
          </div>

            {/* Chart 3: Динамика оборота */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 mb-6 w-full pdf-section">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6">Динамика оборота (кг)</h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.charts.turnoverDynamics} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                    <defs>
                      <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorDispensedTZA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorDispensedVS" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
                      itemStyle={{ color: '#e2e8f0' }}
                      formatter={(value: any, name: string) => [`${Number(value).toFixed(2)} кг`, name]}
                    />
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px' }} />
                    <Area type="monotone" dataKey="received" name="Принято" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorReceived)" />
                    <Area type="monotone" dataKey="dispensedTZA" name="Выдано в ТЗА" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorDispensedTZA)" />
                    <Area type="monotone" dataKey="dispensedVS" name="Выдано в ВС" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#colorDispensedVS)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: График изменения плотности */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 mb-6 w-full pdf-section">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6">График изменения плотности (г/см³)</h3>
              <div className="h-80 w-full">
                {data.charts.densityDynamics && data.charts.densityDynamics.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.charts.densityDynamics} margin={{ top: 20, right: 20, left: 10, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                      <YAxis domain={['dataMin', 'dataMax']} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} tickFormatter={(val) => val.toFixed(4)} width={60} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
                        itemStyle={{ color: '#0ea5e9', fontWeight: 600 }}
                        formatter={(value: any, name: string) => [`${Number(value).toFixed(4)} г/см³`, name]}
                        labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                      />
                      <Line type="monotone" dataKey="density" name="Плотность" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 2, stroke: '#ffffff' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                    <p className="text-sm text-slate-500">Нет данных о плотности за выбранный период</p>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/50 mb-6 w-full pdf-section">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6">Хронология операций</h3>

              {timeline.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4 border border-dashed border-slate-600 rounded-xl">Нет данных для хронологии за текущую смену</p>
              ) : (
                <>
                  {/* Timeline track */}
                  <div className="relative w-full h-12 mb-10">
                    {/* Line */}
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 dark:bg-slate-700 -translate-y-1/2 rounded" />
                    {/* Time labels */}
                    {[['05:00', '0%'], ['11:00', '33.33%'], ['17:00', '66.67%'], ['23:00', '100%']].map(([label, left]) => (
                      <span key={label} className="absolute top-[calc(50%+10px)] text-[10px] text-slate-500 -translate-x-1/2" style={{ left }}>{label}</span>
                    ))}
                    {/* Dots */}
                    {timeline.map((item) => {
                      const dotColor = item.type === 'vs' ? 'bg-green-500' : item.type === 'reception' ? 'bg-blue-500' : item.type === 'tza' ? 'bg-orange-500' : 'bg-slate-400';
                      return (
                        <div
                          key={item.id}
                          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-slate-900 cursor-default transition-transform hover:scale-150 z-10 shadow-md ring-2 ring-slate-800/50 ${dotColor}`}
                          style={{ left: `${timeToPercent(item.time)}%`, transform: 'translateY(-50%) translateX(-50%)' }}
                          title={`${item.time} — ${item.title}: ${item.details}`}
                        />
                      );
                    })}
                  </div>
                  {/* Legend */}
                  <div className="flex flex-wrap gap-4 mt-2">
                    {[['bg-green-500', 'Выдача в ВС'], ['bg-blue-500', 'Прием топлива'], ['bg-orange-500', 'Заправка ТЗА'], ['bg-slate-400', 'Замеры']].map(([color, label]) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <div className={`w-3 h-3 rounded-full ${color}`} />
                        <span className="text-xs text-slate-400">{label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

          {/* Activity Feed */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 mb-6 w-full pdf-section">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-5 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-slate-500" />
                Живая лента операций
              </h3>
              <div className="flex flex-col gap-3">
                {activityFeed.length > 0 ? activityFeed.map((item, idx) => {
                  const time = new Date(item.Timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                  let icon, colorClass, text;
                  
                  if (item.type === 'reception' || item.type === 'reception_auto') {
                    icon = <Download className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
                    colorClass = "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50";
                    text = `Сотрудник ${item.Name} принял ${item.Mass} кг в резервуар ${item.Tank_Name}`;
                  } else if (item.type === 'dispense_tza') {
                    icon = <Truck className="w-5 h-5 text-violet-600 dark:text-violet-400" />;
                    colorClass = "bg-violet-50 dark:bg-violet-900/20 border-violet-100 dark:border-violet-800/50";
                    text = `Сотрудник ${item.Name} выдал ${item.Mass} кг в ${item.TZA} (из ${item.Tank_Name})`;
                  } else if (item.type === 'dispense_vs') {
                    icon = <Plane className="w-5 h-5 text-orange-600 dark:text-orange-400" />;
                    colorClass = "bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800/50";
                    text = `Сотрудник ${item.Name} заправил ВС (Талон №${item.Control_Number}), выдано ${item.Mass} кг`;
                  }

                  return (
                    <div key={idx} className={`flex items-start gap-3 p-4 rounded-xl border ${colorClass} transition-colors`}>
                      <div className="mt-0.5 bg-white dark:bg-slate-800 p-1.5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700">{icon}</div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{text}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">{time}</p>
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-sm text-slate-500 py-4 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">Новых операций пока нет...</p>
                )}
              </div>
            </div>

            {/* Bottom Action */}
            <div className="mt-8 flex justify-center pdf-section">
              <button
                onClick={onBack}
                className="w-full py-4 mt-8 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium rounded-2xl transition-colors"
              >
                На главную
              </button>
            </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-64">
          <p className="text-rose-500">Не удалось загрузить данные.</p>
        </div>
      )}
    </div>
  );
}
