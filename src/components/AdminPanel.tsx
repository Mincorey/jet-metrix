import React, { useState, useEffect } from 'react';
import { X, UserPlus, ShieldAlert, Trash2, Pencil, ChevronUp, ChevronDown, Download, Plus, Activity, AlertTriangle, FileEdit } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Employee } from '../data/Employees';
import * as XLSX from 'xlsx';
import AdminCorrection from './AdminCorrection';

interface TZA {
    id: number;
    Name: string;
    Volume: number;
    Is_Monitoring?: number;
    Current_Volume?: number;
}

interface AdminPanelProps {
    onBack: () => void;
    onNavigateToTanks: () => void;
    onNavigateToSettings: () => void;
    onNavigateToTelegramSettings: () => void;
    onLogout?: () => void;
}

export default function AdminPanel({ onBack, onNavigateToTanks, onNavigateToSettings, onNavigateToTelegramSettings, onLogout }: AdminPanelProps) {
    const { showToast } = useToast();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [adminView, setAdminView] = useState<'menu' | 'correction'>('menu');

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [showClearDbConfirm, setShowClearDbConfirm] = useState(false);

    // Form states
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState<'Авиатехник' | 'Водитель-Авиатехник' | 'Старший авиатехник' | 'Администратор'>('Авиатехник');
    const [newPassword, setNewPassword] = useState('');

    // Accordion state
    const [isListExpanded, setIsListExpanded] = useState(false);

    // Edit states
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [editName, setEditName] = useState('');
    const [editPassword, setEditPassword] = useState('');

    // TZA States
    const [tzas, setTzas] = useState<TZA[]>([]);
    const [loadingTza, setLoadingTza] = useState(true);
    const [isTzaExpanded, setIsTzaExpanded] = useState(false);
    const [showTzaModal, setShowTzaModal] = useState(false);
    const [editingTza, setEditingTza] = useState<TZA | null>(null);
    const [tzaName, setTzaName] = useState('');
    const [tzaVolume, setTzaVolume] = useState('');

    useEffect(() => {
        fetchEmployees();
        fetchTzas();
    }, []);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/employees');
            if (response.ok) {
                const data = await response.json();
                setEmployees(data);
            } else {
                showToast("Ошибка при загрузке сотрудников", "error");
            }
        } catch (error) {
            console.error('Error fetching employees:', error);
            showToast("Ошибка соединения с сервером", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleAddEmployee = async () => {
        if (isSaving) return;
        if (!newName.trim()) {
            showToast('Введите Ф. И. О. сотрудника', 'error');
            return;
        }

        if (!newPassword.trim()) {
            showToast('Введите пароль', 'error');
            return;
        }

        if (newPassword.length !== 6 || !/^\d+$/.test(newPassword)) {
            showToast('Пароль должен состоять ровно из 6 цифр', 'error');
            return;
        }

        try {
            setIsSaving(true);
            const dbRole = newRole === 'Авиатехник' ? 'Avia-Technician' :
                newRole === 'Водитель-Авиатехник' ? 'Driver-AT' :
                newRole === 'Старший авиатехник' ? 'Supervisor' : 'Administrator';

            const response = await fetch('/api/employees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    Name: newName,
                    Role: dbRole,
                    Password: newPassword
                })
            });

            if (response.ok) {
                await fetchEmployees();
                setShowAddModal(false);
                setNewName('');
                setNewRole('Авиатехник');
                setNewPassword('');
                showToast("Сотрудник успешно добавлен", "success");
            } else {
                showToast("Ошибка при сохранении сотрудника", "error");
            }
        } catch (error) {
            console.error("Error adding employee:", error);
            showToast("Ошибка соединения с сервером", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleStatus = async (id: number, currentStatus: string) => {
        if (isSaving) return;
        const newStatus = currentStatus === 'Active' ? 'Archived' : 'Active';
        try {
            setIsSaving(true);
            const response = await fetch(`/api/employees/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                await fetchEmployees();
                showToast(newStatus === 'Active' ? 'Сотрудник восстановлен' : 'Сотрудник перенесен в архив', "success");
            } else {
                showToast("Ошибка при обновлении статуса", "error");
            }
        } catch (error) {
            console.error("Error updating status:", error);
            showToast("Ошибка соединения с сервером", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteEmployee = async (id: number) => {
        if (isSaving) return;
        if (!window.confirm("Удалить сотрудника навсегда?")) return;
        try {
            setIsSaving(true);
            const response = await fetch(`/api/employees/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await fetchEmployees();
                showToast("Сотрудник удален", "success");
            } else {
                showToast("Ошибка при удалении сотрудника", "error");
            }
        } catch (error) {
            console.error("Error deleting employee:", error);
            showToast("Ошибка соединения с сервером", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditEmployee = async () => {
        if (isSaving) return;
        if (!editingEmployee) return;
        if (!editName.trim()) {
            showToast('Введите Ф. И. О. сотрудника', 'error');
            return;
        }

        if (editPassword && (editPassword.length !== 6 || !/^\d+$/.test(editPassword))) {
            showToast('Пароль должен состоять ровно из 6 цифр', 'error');
            return;
        }

        try {
            setIsSaving(true);
            const response = await fetch(`/api/employees/${editingEmployee.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    Name: editName,
                    Password: editPassword
                })
            });

            if (response.ok) {
                await fetchEmployees();
                setEditingEmployee(null);
                setEditPassword('');
                showToast("Успешно обновлено", "success");
            } else {
                showToast("Ошибка при сохранении", "error");
            }
        } catch (error) {
            console.error("Error editing employee:", error);
            showToast("Ошибка соединения с сервером", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const exportEmployeesToExcel = () => {
        const dataToExport = employees.map(emp => ({
            'ID': emp.id,
            'Дата добавления': emp.Date,
            'ФИО': emp.Name,
            'Роль': getRoleDisplayName(emp.Role),
            'Статус': emp.Status === 'Active' ? 'Активен' : 'В архиве',
            'Дата архивации': emp.Archive_Date || '—'
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Архив_Сотрудников");
        XLSX.writeFile(workbook, "Сотрудники_Архив.xlsx");
    };

    const fetchTzas = async () => {
        setLoadingTza(true);
        try {
            const response = await fetch('/api/tza');
            if (response.ok) {
                const data = await response.json();
                setTzas(data);
            } else {
                showToast("Ошибка при загрузке ТЗА", "error");
            }
        } catch (error) {
            console.error('Error fetching TZAs:', error);
            showToast("Ошибка соединения с сервером", "error");
        } finally {
            setLoadingTza(false);
        }
    };

    const handleSaveTza = async () => {
        if (isSaving) return;
        if (!tzaName.trim() || !tzaVolume.trim()) {
            showToast('Заполните Номер/Имя и Объем', 'error');
            return;
        }

        try {
            setIsSaving(true);
            const method = editingTza ? 'PUT' : 'POST';
            const url = editingTza ? `/api/tza/${editingTza.id}` : '/api/tza';
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Name: tzaName, Volume: parseFloat(tzaVolume) })
            });

            if (response.ok) {
                await fetchTzas();
                setShowTzaModal(false);
                setEditingTza(null);
                setTzaName('');
                setTzaVolume('');
                showToast(editingTza ? "ТЗА успешно обновлен" : "ТЗА добавлен", "success");
            } else {
                const err = await response.json();
                showToast(err.error || "Ошибка сохранения ТЗА", "error");
            }
        } catch (error) {
            console.error("Error saving TZA:", error);
            showToast("Ошибка соединения с сервером", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTza = async (id: number) => {
        if (isSaving) return;
        if (!window.confirm("Вы уверены, что хотите удалить этот ТЗА?")) return;
        try {
            setIsSaving(true);
            const response = await fetch(`/api/tza/${id}`, { method: 'DELETE' });
            if (response.ok) {
                await fetchTzas();
                showToast("ТЗА удален", "success");
            } else {
                showToast("Ошибка при удалении", "error");
            }
        } catch (error) {
            console.error("Error deleting TZA:", error);
            showToast("Ошибка соединения с сервером", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleMonitoring = async (id: number, currentStatus: number | undefined) => {
        if (isSaving) return;
        try {
            setIsSaving(true);
            const newStatus = currentStatus === 1 ? false : true;
            const response = await fetch(`/api/tza/${id}/monitoring`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isMonitoring: newStatus })
            });

            if (response.ok) {
                fetchTzas();
                showToast("Статус мониторинга обновлен", "success");
            } else {
                showToast("Не удалось переключить статус мониторинга", "error");
            }
        } catch (error) {
            console.error("Ошибка при переключении мониторинга:", error);
            showToast("Ошибка соединения с сервером", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleClearAll = async () => {
        if (isSaving) return;
        try {
            setIsSaving(true);
            const response = await fetch('/api/employees/all', {
                method: 'DELETE'
            });
            if (response.ok) {
                await fetchEmployees();
                setShowClearConfirm(false);
                showToast("База сотрудников очищена", "success");
            } else {
                showToast("Ошибка при очистке базы", "error");
            }
        } catch (error) {
            console.error("Error clearing employees:", error);
            showToast("Ошибка соединения с сервером", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleClearOperationsDB = async () => {
        if (isSaving) return;
        try {
            setIsSaving(true);
            const response = await fetch(`/api/database/clear-operations`, {
                method: 'DELETE',
            });
            if (response.ok) {
                showToast("Операционные записи успешно удалены", "success");
                setShowClearDbConfirm(false);
            } else {
                showToast("Ошибка при очистке БД", "error");
            }
        } catch (error) {
            console.error(error);
            showToast("Ошибка соединения с сервером", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const getRoleDisplayName = (role: string) => {
        switch (role) {
            case 'Avia-Technician': return 'Авиатехник';
            case 'Driver-AT': return 'Водитель-Авиатехник';
            case 'Supervisor': return 'Ст. авиатехник';
            case 'Administrator': return 'Администратор';
            default: return role;
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('sgsm_saved_user');
        localStorage.removeItem('sgsm_current_view');
        if (onLogout) {
            onLogout();
        } else {
            onBack();
        }
    };

    if (adminView === 'correction') {
        return <AdminCorrection onBack={() => setAdminView('menu')} />;
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col items-center pt-16 pb-20 px-4 font-sans transition-colors duration-200">
            <div className="w-full max-w-md flex flex-col items-center">
                <div className="mb-8 text-center relative w-full">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                        Панель администратора
                    </h1>
                </div>

                {/* Action Buttons */}
                <div className="w-full mb-6">
                    <button
                        onClick={onNavigateToTanks}
                        className="w-full bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-lg font-bold py-5 px-10 rounded-2xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                    >
                        Склад (Конструктор)
                    </button>
                    <button
                        onClick={onNavigateToSettings}
                        className="w-full mt-4 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-lg font-bold py-5 px-10 rounded-2xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                    >
                        Настройки приложения
                    </button>
                    <button
                        onClick={() => setAdminView('correction')}
                        className="w-full mt-4 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-lg font-bold py-5 px-10 rounded-2xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                    >
                        <FileEdit className="w-5 h-5 text-indigo-500" />
                        Корректировка
                    </button>
                    <button
                        onClick={onNavigateToTelegramSettings}
                        className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold py-5 px-10 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-2 border-none"
                    >
                        Telegram-бот
                    </button>
                </div>

                {/* Employee List */}
                <div className="w-full bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm mb-6">
                    <div className="flex justify-between items-center mb-6">
                        <div
                            className="flex items-center gap-2 cursor-pointer group w-full"
                            onClick={() => setIsListExpanded(!isListExpanded)}
                        >
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Список сотрудников</h3>
                            <div className="bg-slate-100 dark:bg-slate-700 p-1.5 rounded-full text-slate-500 transition-colors group-hover:bg-slate-200 dark:group-hover:bg-slate-600 ml-auto mr-2">
                                {isListExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </div>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowAddModal(true);
                            }}
                            className="w-12 h-12 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-2xl font-light flex-shrink-0"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Добавить сотрудника"
                        >
                            <Plus className="w-6 h-6" />
                        </button>
                    </div>

                    {isListExpanded && (
                        loading ? (
                            <div className="text-center py-8 text-slate-500">Загрузка...</div>
                        ) : employees.length === 0 ? (
                            <div className="text-center py-8 px-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                <p className="text-slate-500 dark:text-slate-400 text-sm">База сотрудников пуста.</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col gap-3">
                                {employees.map((emp) => (
                                    <div key={emp.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 dark:bg-slate-700 p-4 rounded-xl border border-slate-200 dark:border-slate-600 gap-4 sm:gap-0">
                                        <div className="flex items-start sm:items-center gap-3">
                                            <span
                                                className={`w-3 h-3 rounded-full flex-shrink-0 mt-1.5 sm:mt-0 ${emp.Status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`}
                                                title={emp.Status === 'Active' ? 'Активен' : 'В архиве'}
                                            ></span>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800 dark:text-slate-100 text-base">
                                                    {emp.Name}
                                                </span>
                                                <div className="flex gap-2 items-center mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                    <span className="font-medium bg-slate-200 dark:bg-slate-600 px-2 py-0.5 rounded-md text-xs text-slate-700 dark:text-slate-300">
                                                        {getRoleDisplayName(emp.Role)}
                                                    </span>
                                                    <span className="text-slate-400">•</span>
                                                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">{emp.Date}</span>
                                                </div>
                                            </div>
                                        </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingEmployee(emp);
                                                        setEditName(emp.Name);
                                                        setEditPassword('');
                                                    }}
                                                    className="flex items-center justify-center w-10 h-10 rounded-xl transition-colors text-slate-500 hover:text-slate-700 bg-slate-200 hover:bg-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:bg-slate-600 dark:hover:bg-slate-500"
                                                    title="Редактировать сотрудника"
                                                >
                                                    <Pencil className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteEmployee(emp.id)}
                                                    className="flex items-center justify-center w-10 h-10 rounded-xl transition-colors bg-rose-500 hover:bg-rose-600 text-white"
                                                    title="Удалить навсегда"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(emp.id, emp.Status)}
                                                    className={`flex items-center justify-center h-10 px-4 rounded-xl transition-colors shadow-sm text-sm font-bold ${emp.Status === 'Active'
                                                        ? 'text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-slate-50 bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500'
                                                        : 'text-emerald-800 bg-emerald-100 hover:bg-emerald-200 dark:text-emerald-200 dark:bg-emerald-900/60 dark:hover:bg-emerald-800'
                                                        }`}
                                                >
                                                    {emp.Status === 'Active' ? 'В архив' : 'Восстановить'}
                                                </button>
                                            </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-col gap-3 mt-6 pt-6 border-t border-slate-200 dark:border-slate-700/50">
                                <button
                                    onClick={exportEmployeesToExcel}
                                    className="w-full flex justify-center items-center py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white transition-colors text-base font-semibold gap-2"
                                >
                                    <Download className="w-5 h-5" />
                                    <span>Скачать архив сотрудников</span>
                                </button>
                                <button
                                    onClick={() => setShowClearConfirm(true)}
                                    className="w-full flex justify-center items-center py-3 px-4 rounded-xl border border-red-900/50 text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors font-medium text-base gap-2"
                                >
                                    <Trash2 className="w-5 h-5" />
                                    Очистить базу сотрудников
                                </button>
                            </div>
                        </>
                        )
                    )}
                </div>

                {/* TZA List */}
                <div className="w-full bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm mb-6">
                    <div className="flex justify-between items-center mb-6">
                        <div
                            className="flex items-center gap-2 cursor-pointer group w-full"
                            onClick={() => setIsTzaExpanded(!isTzaExpanded)}
                        >
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400">ТЗА</h3>
                            <div className="bg-slate-100 dark:bg-slate-700 p-1.5 rounded-full text-slate-500 transition-colors group-hover:bg-slate-200 dark:group-hover:bg-slate-600 ml-auto mr-2">
                                {isTzaExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setEditingTza(null);
                                setTzaName('');
                                setTzaVolume('');
                                setShowTzaModal(true);
                            }}
                            className="w-12 h-12 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-2xl font-light flex-shrink-0"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Plus className="w-6 h-6" />
                        </button>
                    </div>

                    {isTzaExpanded && (
                        loadingTza ? (
                            <div className="text-center py-8 text-slate-500">Загрузка ТЗА...</div>
                        ) : tzas.length === 0 ? (
                            <div className="text-center py-8 px-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                <p className="text-slate-500 dark:text-slate-400 text-sm">Список ТЗА пуст.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {tzas.map((tza) => (
                                    <div key={tza.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700 p-4 rounded-xl border border-slate-200 dark:border-slate-600">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-800 dark:text-slate-100 text-base">
                                                ТЗА-{tza.Name}
                                            </span>
                                            <span className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                                Объем: {tza.Volume} л.
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleToggleMonitoring(tza.id, tza.Is_Monitoring)}
                                                className={`p-3 rounded-xl transition-colors ${tza.Is_Monitoring === 1
                                                        ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                                        : 'bg-slate-200 dark:bg-slate-600 text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-500'
                                                    }`}
                                                title={tza.Is_Monitoring === 1 ? "Остановить мониторинг" : "Начать мониторинг (сброс до полного бака)"}
                                            >
                                                <Activity size={20} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEditingTza(tza);
                                                    setTzaName(tza.Name);
                                                    setTzaVolume(tza.Volume.toString());
                                                    setShowTzaModal(true);
                                                }}
                                                className="text-slate-500 hover:text-slate-700 bg-slate-200 hover:bg-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:bg-slate-600 dark:hover:bg-slate-500 w-12 h-12 flex items-center justify-center rounded-xl transition-colors"
                                            >
                                                <Pencil className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTza(tza.id)}
                                                className="text-rose-500 hover:text-rose-700 bg-rose-100 hover:bg-rose-200 dark:text-rose-400 dark:hover:text-rose-200 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 w-12 h-12 flex items-center justify-center rounded-xl transition-colors"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>

                <div className="w-full flex flex-col gap-4 mt-8 mb-4">
                    <button
                        onClick={handleLogout}
                        className="w-full py-4 px-6 rounded-xl font-bold transition-all border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-2"
                    >
                        Закрыть сессию
                    </button>
                    <a
                        href="/api/backup"
                        download="sgsm_backup.db"
                        className="px-6 py-4 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-xl hover:bg-indigo-200 dark:hover:bg-indigo-900/50 w-full font-bold text-lg transition-colors flex justify-center items-center gap-2 shadow-sm"
                    >
                        <Download className="w-6 h-6" />
                        Скачать бэкап БД
                    </a>
                    <button
                        onClick={() => setShowClearDbConfirm(true)}
                        className="w-full bg-red-600/10 hover:bg-red-600/20 text-red-500 font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 border border-red-500/20"
                    >
                        <Trash2 className="w-5 h-5" />
                        <span>Удалить все операции</span>
                    </button>

                    <button
                        onClick={onBack}
                        className="w-full py-4 mt-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-2xl transition-colors"
                    >
                        На главную
                    </button>
                </div>
            </div>

            {/* Add Employee Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl relative scrollbar-hide my-auto max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Новый сотрудник</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex flex-col gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Ф.И.О.
                                </label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 transition-colors"
                                    placeholder="Иванов И. И."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Должность
                                </label>
                                <div className="flex flex-col gap-2">
                                    {(['Авиатехник', 'Водитель-Авиатехник', 'Старший авиатехник', 'Администратор'] as const).map(role => (
                                        <button
                                            key={role}
                                            onClick={() => setNewRole(role)}
                                            className={`w-full text-left px-5 py-4 rounded-xl text-base font-semibold transition-colors border ${newRole === role
                                                ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-600'
                                                : 'border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700/50'
                                                }`}
                                        >
                                            {role}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    PIN-код (6 цифр)
                                </label>
                                <input
                                    type="password"
                                    maxLength={6}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, ''))}
                                    className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 transition-colors tracking-widest"
                                    placeholder="••••••"
                                    inputMode="decimal"
                                />
                            </div>

                            <div className="flex gap-3 mt-2">
                                <button
                                    onClick={handleAddEmployee}
                                    disabled={isSaving}
                                    className={`flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold py-4 rounded-xl transition-all shadow-sm active:scale-95 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {isSaving ? 'Добавление...' : 'Добавить'}
                                </button>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    disabled={isSaving}
                                    className={`flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-base font-bold py-4 rounded-xl transition-all shadow-sm active:scale-95 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    Отмена
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Clear Database Confirmation Modal */}
            {showClearConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl transform transition-all">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0">
                                <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Очистить базу?</h3>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                            Вы уверены, что хотите удалить ВСЕХ сотрудников? Это действие необратимо. Вам потребуется создать минимум одного Администратора заново.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={handleClearAll}
                                disabled={isSaving}
                                className={`flex-[3] bg-rose-600 hover:bg-rose-700 text-white text-base font-bold py-4 rounded-xl transition-colors shadow-sm active:scale-95 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {isSaving ? 'Очистка...' : 'Да, очистить'}
                            </button>
                            <button
                                onClick={() => setShowClearConfirm(false)}
                                disabled={isSaving}
                                className={`flex-[2] bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-base font-bold py-4 rounded-xl transition-colors active:scale-95 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Employee Modal */}
            {editingEmployee && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl relative scrollbar-hide my-auto max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Редактирование</h3>
                            <button onClick={() => setEditingEmployee(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex flex-col gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Ф.И.О.
                                </label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    PIN-код
                                </label>
                                <input
                                    type="password"
                                    maxLength={6}
                                    value={editPassword}
                                    onChange={(e) => setEditPassword(e.target.value.replace(/\D/g, ''))}
                                    className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 transition-colors tracking-widest text-center"
                                    placeholder="Оставьте пустым, чтобы не менять"
                                    inputMode="decimal"
                                />
                                <p className="text-xs text-slate-500 mt-2 text-center">Если не вводить, старый PIN-код сохранится.</p>
                            </div>

                            <div className="flex gap-3 mt-2">
                                <button
                                    onClick={handleEditEmployee}
                                    disabled={isSaving}
                                    className={`flex-[3] bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold py-4 rounded-xl transition-all shadow-sm active:scale-95 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {isSaving ? 'Сохранение...' : 'Сохранить'}
                                </button>
                                <button
                                    onClick={() => setEditingEmployee(null)}
                                    disabled={isSaving}
                                    className={`flex-[2] bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-base font-bold py-4 rounded-xl transition-all shadow-sm active:scale-95 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    Отмена
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit TZA Modal */}
            {showTzaModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl relative scrollbar-hide my-auto max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                                {editingTza ? 'Редактировать ТЗА' : 'Новый ТЗА'}
                            </h3>
                            <button onClick={() => setShowTzaModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex flex-col gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Номер/Имя ТЗА
                                </label>
                                <input
                                    type="text"
                                    value={tzaName}
                                    onChange={(e) => setTzaName(e.target.value)}
                                    className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 transition-colors"
                                    placeholder="Например: 173"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Полный объем (литры)
                                </label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={tzaVolume}
                                    onChange={(e) => setTzaVolume(e.target.value.replace(/[^0-9.]/g, ''))}
                                    className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 transition-colors"
                                    placeholder="Например: 22000"
                                />
                            </div>

                            <div className="flex gap-3 mt-2">
                                <button
                                    onClick={handleSaveTza}
                                    disabled={isSaving}
                                    className={`flex-[3] bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold py-4 rounded-xl transition-all shadow-sm active:scale-95 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {isSaving ? 'Сохранение...' : 'Сохранить'}
                                </button>
                                <button
                                    onClick={() => setShowTzaModal(false)}
                                    disabled={isSaving}
                                    className={`flex-[2] bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-base font-bold py-4 rounded-xl transition-all shadow-sm active:scale-95 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    Отмена
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Clear Database Confirmation Modal */}
            {showClearDbConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">
                        <div className="flex items-center gap-3 text-red-500 mb-4">
                            <AlertTriangle className="w-8 h-8" />
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Очистка БД</h3>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                            Вы уверены, что хотите удалить <strong>все записи операций</strong> (приемы, выдачи, замеры)? <br /><br />
                            <span className="text-red-500 text-sm">Внимание: Это действие необратимо! Список сотрудников и настройки резервуаров сохранятся.</span>
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={handleClearOperationsDB}
                                disabled={isSaving}
                                className={`flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-3 rounded-xl transition-colors ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {isSaving ? 'Очистка...' : 'Да, очистить'}
                            </button>
                            <button
                                onClick={() => setShowClearDbConfirm(false)}
                                disabled={isSaving}
                                className={`flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-medium py-3 rounded-xl transition-colors ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
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
