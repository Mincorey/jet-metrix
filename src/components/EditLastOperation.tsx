import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface EditLastOpProps {
  workdayId: number;
  onClose: () => void;
}

export default function EditLastOperation({ workdayId, onClose }: EditLastOpProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [op, setOp] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [tanks, setTanks] = useState<any[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const tRes = await fetch('/api/tanks');
        if (tRes.ok) {
           const tData = await tRes.json();
           setTanks(tData.map((t:any) => ({...t, Calibration: JSON.parse(t.Calibration||'[]')})));
        }
        const res = await fetch(`/api/operations/last/${workdayId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.error) {
            showToast(data.error, 'error');
            onClose();
          } else {
            setOp(data);
            setFormData(data);
          }
        }
      } catch(e) {
        showToast('Ошибка загрузки', 'error');
        onClose();
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [workdayId]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    let newVol = op.Volume;
    let newMass = op.Mass;
    const parseF = (val: any) => parseFloat(String(val).replace(',', '.')) || 0;

    if (['reception', 'reception_auto', 'dispense_tza', 'dispense_vs', 'in_warehouse'].includes(op.operationType)) {
       const before = parseF(formData.Counter_Before);
       const after = parseF(formData.Counter_After);
       const dens = parseF(formData.Density);
       if (after < before) return showToast('Счетчик ПОСЛЕ меньше ДО', 'error');
       newVol = parseFloat((after - before).toFixed(2));
       newMass = parseFloat((newVol * dens).toFixed(2));
    }

    if (['measurement', 'train'].includes(op.operationType)) {
       const l1 = parseInt(formData.Level_1) || 0;
       const l2 = parseInt(formData.Level_2) || 0;
       const l3 = parseInt(formData.Level_3) || 0;
       const avg = Math.round((l1+l2+l3)/3);
       const dens = parseF(formData.Density);
       const targetTank = tanks.find(t => t.Name === (op.operationType === 'train' ? formData.Type : formData.Tank_Name));
       
       if (targetTank && targetTank.Calibration) {
          const exact = targetTank.Calibration.find((r:any) => Number(r.level || r.Level) === avg);
          if (exact) {
             newVol = Number(String(exact.volume || exact.Volume).replace(',','.'));
          } else {
             const sorted = [...targetTank.Calibration].sort((a,b)=> Number(a.level||a.Level) - Number(b.level||b.Level));
             const lower = sorted.filter((r:any) => Number(r.level||r.Level) < avg).pop();
             const upper = sorted.filter((r:any) => Number(r.level||r.Level) > avg).shift();
             if (lower && upper) {
                const lL = Number(lower.level||lower.Level), uL = Number(upper.level||upper.Level);
                const lV = Number(String(lower.volume||lower.Volume).replace(',','.')), uV = Number(String(upper.volume||upper.Volume).replace(',','.'));
                newVol = lV + (uV - lV) * ((avg - lL) / (uL - lL));
             }
          }
          newVol = parseFloat(newVol.toFixed(2));
       }
       newMass = parseFloat((newVol * dens).toFixed(2));
       formData.Average_Level = avg;
    }

    const payload = { operationType: op.operationType, id: op.id, data: { ...formData, Volume: newVol, Mass: newMass } };
    delete payload.data.operationType;

    setIsSaving(true);
    try {
      const res = await fetch('/api/operations/edit-last', {
         method: 'POST',
         headers: {'Content-Type': 'application/json'},
         body: JSON.stringify(payload)
      });
      if (res.ok) {
         showToast('Операция обновлена!', 'success');
         onClose();
      } else {
         showToast('Ошибка сохранения', 'error');
      }
    } catch(e) {
       showToast('Ошибка сети', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    const payload = { operationType: op.operationType, id: op.id, action: 'delete' };

    setIsSaving(true);
    try {
      const res = await fetch('/api/operations/edit-last', {
         method: 'POST',
         headers: {'Content-Type': 'application/json'},
         body: JSON.stringify(payload)
      });
      if (res.ok) {
         showToast('Операция успешно удалена', 'success');
         onClose();
      } else {
         showToast('Ошибка при удалении', 'error');
      }
    } catch(e) {
       showToast('Ошибка сети', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return null;
  if (!op) return null;

  const renderFields = () => {
     const type = op.operationType;
     const fields = [];
     if (type === 'reception_auto') fields.push({ key: 'Gos_Number', label: 'Гос. номер АЦ' });
     if (['dispense_tza', 'dispense_vs'].includes(type)) fields.push({ key: 'TZA', label: 'ТЗА' });
     if (type === 'dispense_vs') fields.push({ key: 'Control_Number', label: 'Контрольный талон' });
     if (type === 'train') fields.push({ key: 'Number', label: 'Номер вагона' });
     if (['reception', 'reception_auto', 'dispense_tza', 'dispense_vs', 'in_warehouse'].includes(type)) {
        fields.push({ key: 'Counter_Before', label: 'Счетчик ДО' });
        fields.push({ key: 'Counter_After', label: 'Счетчик ПОСЛЕ' });
     }
     if (['measurement', 'train'].includes(type)) {
        fields.push({ key: 'Level_1', label: 'Замер 1 (мм)' });
        fields.push({ key: 'Level_2', label: 'Замер 2 (мм)' });
        fields.push({ key: 'Level_3', label: 'Замер 3 (мм)' });
     }
     fields.push({ key: 'Density', label: 'Плотность' });
     if (['measurement', 'train', 'reception_auto', 'in_warehouse'].includes(type)) fields.push({ key: 'Temperature', label: 'Температура' });

     return fields.map(f => (
        <div key={f.key} className="mb-3">
           <label className="block text-sm font-medium text-slate-400 dark:text-slate-500 mb-1">{f.label}</label>
           <input
             type="text"
             value={formData[f.key] || ''}
             onChange={e => handleChange(f.key, e.target.value)}
             className="w-full bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl p-3 border border-slate-300 dark:border-slate-600 outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
           />
        </div>
     ));
  };

  const titleMap: any = {
    reception: 'Прием топлива', reception_auto: 'Прием из АЦ', dispense_tza: 'Выдача в ТЗА',
    dispense_vs: 'Выдача в ВС', measurement: 'Замер резервуара', train: 'Замер цистерны', in_warehouse: 'Перекачка'
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-700">
         <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-700 shrink-0">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Редактирование</h3>
            <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"><X className="w-5 h-5" /></button>
         </div>
         <div className="p-6 overflow-y-auto">
            <div className="text-emerald-600 dark:text-emerald-400 text-sm font-bold mb-4 uppercase tracking-wider">{titleMap[op.operationType]}</div>
            {renderFields()}
         </div>
         <div className="p-6 border-t border-slate-100 dark:border-slate-700 shrink-0 flex flex-col gap-3">
            <button onClick={handleSave} disabled={isSaving} className={`w-full bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold py-4 rounded-xl transition-all active:scale-95 shadow-md ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}>{isSaving ? 'Сохранение...' : 'Сохранить'}</button>
            <button onClick={() => setShowDeleteConfirm(true)} disabled={isSaving} className={`w-full bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold py-3.5 rounded-xl transition-all active:scale-95 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}>Удалить последнюю операцию</button>
         </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-xs shadow-xl text-center">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Удаление операции</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Вы уверены, что хотите удалить эту операцию из базы данных? Это действие нельзя отменить.</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleDelete} disabled={isSaving} className={`w-full bg-rose-600 hover:bg-rose-700 text-white font-medium py-3 rounded-xl transition-colors ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}>{isSaving ? 'Удаление...' : 'Да, удалить'}</button>
              <button onClick={() => setShowDeleteConfirm(false)} disabled={isSaving} className={`w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium py-3 rounded-xl transition-colors ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}