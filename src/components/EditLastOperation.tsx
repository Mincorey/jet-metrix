import React, { useState, useEffect, useMemo } from 'react';
import { X, ArrowLeft, ChevronRight, Search, AlertCircle, Filter } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { getVolumeFromCalibration } from '../utils/calibrationHelper';

interface EditLastOpProps {
  workdayId: number;
  onClose: () => void;
}

const titleMap: Record<string, string> = {
  reception: 'Прием топлива',
  reception_auto: 'Прием из АЦ',
  dispense_tza: 'Выдача в ТЗА',
  dispense_vs: 'Выдача в ВС',
  measurement: 'Замер резервуара',
  train: 'Замер цистерны',
  in_warehouse: 'Перекачка'
};

const filterCategories = [
  { id: 'all', label: 'Все' },
  { id: 'reception', label: 'Прием', types: ['reception', 'reception_auto'] },
  { id: 'dispense', label: 'Выдача', types: ['dispense_tza', 'dispense_vs'] },
  { id: 'measurement', label: 'Замеры', types: ['measurement', 'train'] },
  { id: 'transfer', label: 'Перекачка', types: ['in_warehouse'] },
];

const getBadgeStyle = (type: string) => {
  switch (type) {
    case 'reception':
    case 'reception_auto':
      return 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50';
    case 'dispense_tza':
    case 'dispense_vs':
      return 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50';
    case 'measurement':
    case 'train':
      return 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900/50';
    case 'in_warehouse':
      return 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800';
  }
};

const getOpSummary = (op: any) => {
  const type = op.operationType;
  const vol = Math.round(op.Volume || 0);
  if (type === 'reception') {
    return `${op.Tank_Name} • ${vol.toLocaleString('ru-RU')} л`;
  }
  if (type === 'reception_auto') {
    return `${op.Tank_Name} (${op.Gos_Number || 'АЦ'}) • ${vol.toLocaleString('ru-RU')} л`;
  }
  if (type === 'dispense_tza') {
    return `${op.TZA} из ${op.Tank_Name} • ${vol.toLocaleString('ru-RU')} л`;
  }
  if (type === 'dispense_vs') {
    return `${op.TZA} (КТ: №${op.Control_Number || '—'}) • ${vol.toLocaleString('ru-RU')} л`;
  }
  if (type === 'measurement') {
    return `${op.Tank_Name} • Уровень ${op.Average_Level ?? '—'} мм (${vol.toLocaleString('ru-RU')} л)`;
  }
  if (type === 'train') {
    return `Вагон №${op.Number || '—'} • Уровень ${op.Average_Level ?? '—'} мм`;
  }
  if (type === 'in_warehouse') {
    return `Из ${op.From_Tank} в ${op.To_Tank} • ${vol.toLocaleString('ru-RU')} л`;
  }
  return '';
};

export default function EditLastOperation({ workdayId, onClose }: EditLastOpProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [operations, setOperations] = useState<any[]>([]);
  const [isShiftOpen, setIsShiftOpen] = useState(true);
  const [selectedOp, setSelectedOp] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [tanks, setTanks] = useState<any[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  const fetchOperations = async () => {
    try {
      setLoading(true);
      // Fetch all operations for this shift without limit
      const res = await fetch(`/api/operations/last/${workdayId}?limit=all`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setOperations(data);
        } else if (data.error) {
          setOperations([]);
        } else {
          setOperations([data]);
        }
      } else {
        setOperations([]);
      }

      // Check current workday status to prevent editing closed shifts
      const wdRes = await fetch(`/api/workdays`);
      if (wdRes.ok) {
        const workdays = await wdRes.json();
        if (Array.isArray(workdays)) {
          const currentWd = workdays.find((w: any) => w.id === workdayId);
          if (currentWd && currentWd.Workday_Status && currentWd.Workday_Status !== 'Open') {
            setIsShiftOpen(false);
          } else {
            setIsShiftOpen(true);
          }
        }
      }
    } catch (e) {
      showToast('Ошибка загрузки списка операций', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const tRes = await fetch('/api/tanks');
        if (tRes.ok) {
          const tData = await tRes.json();
          setTanks(tData.map((t: any) => ({ ...t, Calibration: JSON.parse(t.Calibration || '[]') })));
        }
        await fetchOperations();
      } catch (e) {
        showToast('Ошибка загрузки данных', 'error');
        onClose();
      }
    };
    init();
  }, [workdayId]);

  const handleSelectOp = (op: any) => {
    setSelectedOp(op);
    setFormData(op);
  };

  const handleBackToList = () => {
    setSelectedOp(null);
    setFormData({});
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!selectedOp) return;
    if (!isShiftOpen) {
      return showToast('Нельзя редактировать операции: смена уже закрыта', 'error');
    }

    let newVol = selectedOp.Volume;
    let newMass = selectedOp.Mass;
    const parseF = (val: any) => parseFloat(String(val).replace(',', '.')) || 0;

    if (['reception', 'reception_auto', 'dispense_tza', 'in_warehouse'].includes(selectedOp.operationType)) {
      const before = parseF(formData.Counter_Before);
      const after = parseF(formData.Counter_After);
      const dens = parseF(formData.Density);
      if (after < before) return showToast('Счетчик ПОСЛЕ меньше ДО', 'error');
      newVol = parseFloat((after - before).toFixed(2));
      if (selectedOp.operationType === 'dispense_tza' && newVol > 25000) {
        return showToast('Объем выдачи в ТЗА не может превышать 25 000 л.', 'error');
      }
      newMass = parseFloat((newVol * dens).toFixed(2));
    }

    if (selectedOp.operationType === 'dispense_vs') {
      newVol = parseF(formData.Volume);
      if (newVol > 25000) {
        return showToast('Объем выдачи в ВС не может превышать 25 000 л.', 'error');
      }
      const dens = parseF(formData.Density);
      newMass = Math.round(newVol * dens);
    }

    if (['measurement', 'train'].includes(selectedOp.operationType)) {
      const l1 = parseInt(formData.Level_1) || 0;
      const l2 = parseInt(formData.Level_2) || 0;
      const l3 = parseInt(formData.Level_3) || 0;
      const avg = Math.round((l1 + l2 + l3) / 3);
      const dens = parseF(formData.Density);
      const targetTank = tanks.find(t => t.Name === (selectedOp.operationType === 'train' ? formData.Type : formData.Tank_Name));

      if (targetTank && targetTank.Calibration) {
        const category = selectedOp.operationType === 'train' ? 'train' : 'tank';
        const calculatedVol = getVolumeFromCalibration(targetTank.Calibration, avg, category);
        newVol = parseFloat(calculatedVol.toFixed(2));
      }
      newMass = parseFloat((newVol * dens).toFixed(2));
      formData.Average_Level = avg;
    }

    const payload = { operationType: selectedOp.operationType, id: selectedOp.id, data: { ...formData, Volume: newVol, Mass: newMass } };
    delete payload.data.operationType;

    setIsSaving(true);
    try {
      const res = await fetch('/api/operations/edit-last', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Операция обновлена!', 'success');
        await fetchOperations();
        handleBackToList();
      } else {
        showToast(data.message || data.error || 'Ошибка сохранения', 'error');
      }
    } catch (e) {
      showToast('Ошибка сети', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedOp) return;
    if (!isShiftOpen) {
      return showToast('Нельзя удалять операции: смена уже закрыта', 'error');
    }

    const payload = { operationType: selectedOp.operationType, id: selectedOp.id, action: 'delete' };

    setIsSaving(true);
    try {
      const res = await fetch('/api/operations/edit-last', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Операция успешно удалена', 'success');
        setShowDeleteConfirm(false);
        await fetchOperations();
        handleBackToList();
      } else {
        showToast(data.message || data.error || 'Ошибка при удалении', 'error');
      }
    } catch (e) {
      showToast('Ошибка сети', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredOperations = useMemo(() => {
    return operations.filter(op => {
      // Category filter
      if (selectedFilter !== 'all') {
        const cat = filterCategories.find(c => c.id === selectedFilter);
        if (cat?.types && !cat.types.includes(op.operationType)) {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const typeLabel = (titleMap[op.operationType] || '').toLowerCase();
        const tank = (op.Tank_Name || op.From_Tank || op.To_Tank || '').toLowerCase();
        const tza = (op.TZA || '').toLowerCase();
        const gosNum = (op.Gos_Number || '').toLowerCase();
        const num = String(op.Number || op.Control_Number || '').toLowerCase();
        const date = (op.Date || '').toLowerCase();

        return typeLabel.includes(q) || tank.includes(q) || tza.includes(q) || gosNum.includes(q) || num.includes(q) || date.includes(q);
      }

      return true;
    });
  }, [operations, selectedFilter, searchQuery]);

  const renderFields = () => {
    if (!selectedOp) return null;
    const type = selectedOp.operationType;
    const fields = [];
    if (type === 'reception_auto') fields.push({ key: 'Gos_Number', label: 'Гос. номер АЦ' });
    if (['dispense_tza', 'dispense_vs'].includes(type)) fields.push({ key: 'TZA', label: 'ТЗА' });
    if (type === 'dispense_vs') {
      fields.push({ key: 'Control_Number', label: 'Контрольный талон' });
      fields.push({ key: 'Volume', label: 'Количество выданного топлива, л.', inputMode: 'decimal' });
    }
    if (type === 'train') fields.push({ key: 'Number', label: 'Номер вагона' });
    if (['reception', 'reception_auto', 'dispense_tza', 'in_warehouse'].includes(type)) {
      fields.push({ key: 'Counter_Before', label: 'Счетчик ДО', inputMode: 'decimal' });
      fields.push({ key: 'Counter_After', label: 'Счетчик ПОСЛЕ', inputMode: 'decimal' });
    }
    if (['measurement', 'train'].includes(type)) {
      fields.push({ key: 'Level_1', label: 'Замер 1 (мм)', inputMode: 'numeric' });
      fields.push({ key: 'Level_2', label: 'Замер 2 (мм)', inputMode: 'numeric' });
      fields.push({ key: 'Level_3', label: 'Замер 3 (мм)', inputMode: 'numeric' });
    }
    fields.push({ key: 'Density', label: 'Плотность (г/см³)', inputMode: 'decimal' });
    if (['measurement', 'train', 'reception_auto', 'in_warehouse'].includes(type)) {
      fields.push({ key: 'Temperature', label: 'Температура (°C)', inputMode: 'decimal' });
    }

    return fields.map(f => (
      <div key={f.key} className="mb-3">
        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{f.label}</label>
        <input
          type="text"
          inputMode={(f.inputMode as any) || 'text'}
          disabled={!isShiftOpen}
          value={formData[f.key] !== undefined && formData[f.key] !== null ? formData[f.key] : ''}
          onChange={e => handleChange(f.key, e.target.value)}
          className={`w-full bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl p-3 border border-slate-300 dark:border-slate-600 outline-none focus:ring-2 focus:ring-emerald-500 font-mono ${
            !isShiftOpen ? 'opacity-60 cursor-not-allowed' : ''
          }`}
        />
      </div>
    ));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-700">

        {/* HEADER */}
        <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            {selectedOp && (
              <button
                onClick={handleBackToList}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 mr-1 transition-colors"
                title="Назад к списку"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                {selectedOp ? 'Редактирование' : 'Операции смены'}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {selectedOp ? titleMap[selectedOp.operationType] : `Всего операций: ${operations.length}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CLOSED SHIFT WARNING */}
        {!isShiftOpen && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs shrink-0 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Смена закрыта. Корректировка и удаление операций заблокированы.</span>
          </div>
        )}

        {/* CONTENT */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
            <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Загрузка операций смены...</p>
          </div>
        ) : !selectedOp ? (
          /* STEP 1: LIST VIEW */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Search & Category Filter */}
            {operations.length > 0 && (
              <div className="p-3 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/50 space-y-2 shrink-0">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Поиск по операциям..."
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filters */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                  {filterCategories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedFilter(cat.id)}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-lg shrink-0 transition-all ${
                        selectedFilter === cat.id
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-200/70 hover:bg-slate-200 text-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {operations.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
                  В этой смене еще нет операций.
                </div>
              ) : filteredOperations.length === 0 ? (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
                  Ничего не найдено по запросу.
                </div>
              ) : (
                filteredOperations.map(op => {
                  const formattedDate = op.Date ? op.Date.split(' ')?.[1] || op.Date : '';
                  return (
                    <button
                      key={`${op.operationType}-${op.id}`}
                      onClick={() => handleSelectOp(op)}
                      className="w-full text-left bg-slate-50 dark:bg-slate-700/30 hover:bg-slate-100 dark:hover:bg-slate-700/60 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 transition-all flex items-center justify-between active:scale-[0.98] group shadow-sm hover:shadow"
                    >
                      <div className="space-y-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider ${getBadgeStyle(op.operationType)}`}>
                            {titleMap[op.operationType] || op.operationType}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">{formattedDate}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                          {getOpSummary(op)}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* STEP 2: EDIT VIEW */
          <>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex items-center justify-between mb-4">
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold border uppercase tracking-wider ${getBadgeStyle(selectedOp.operationType)}`}>
                  {titleMap[selectedOp.operationType]}
                </span>
                {selectedOp.Date && (
                  <span className="text-xs text-slate-400 font-mono">
                    {selectedOp.Date}
                  </span>
                )}
              </div>
              {renderFields()}
            </div>

            {isShiftOpen ? (
              <div className="p-5 border-t border-slate-100 dark:border-slate-700 shrink-0 flex flex-col gap-2.5 bg-slate-50/50 dark:bg-slate-800/50">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className={`w-full bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold py-3.5 rounded-xl transition-all active:scale-95 shadow-md ${
                    isSaving ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {isSaving ? 'Сохранение...' : 'Внести изменения'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSaving}
                  className={`w-full bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold py-3 rounded-xl transition-all active:scale-95 text-sm ${
                    isSaving ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  Удалить операцию
                </button>
              </div>
            ) : (
              <div className="p-5 border-t border-slate-100 dark:border-slate-700 shrink-0 text-center text-xs text-slate-400">
                Редактирование недоступно, так как смена закрыта.
              </div>
            )}
          </>
        )}
      </div>

      {/* DELETE CONFIRM MODAL */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-xs shadow-xl text-center border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Удаление операции</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Вы уверены, что хотите удалить эту операцию из базы данных? Это действие нельзя отменить.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleDelete}
                disabled={isSaving}
                className={`w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl transition-colors ${
                  isSaving ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {isSaving ? 'Удаление...' : 'Да, удалить'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isSaving}
                className={`w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium py-3 rounded-xl transition-colors ${
                  isSaving ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}