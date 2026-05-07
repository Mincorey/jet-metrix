import { useState, useEffect } from 'react';
import { X, Moon, Sun, AlertTriangle } from 'lucide-react';
import { getQueue, removeFromQueue } from './utils/offlineQueue';
import { fetchEmployees, addEmployee, deleteEmployee, EmployeeRole, Employee } from './data/Employees';
import {
  WorkdayRecord,
  openWorkdayDB,
  closeWorkdayDB,
  deleteWorkday,
  getOpenWorkday
} from './data/WORKDAY';
import { fuelReceptionTable } from './data/Fuel_Reception';
import { fuelDispensingTZATable } from './data/Fuel_Dispensing_TZA';
import { fuelDispensingVSTable } from './data/Fuel_Dispensing_VS';
import FuelMeasurement from './components/FuelMeasurement';
import TrainMeasurement from './components/TrainMeasurement';
import FuelReception from './components/FuelReception';
import FuelReceptionAuto from './components/FuelReceptionAuto';
import FuelDispensingTZA from './components/FuelDispensingTZA';
import FuelDispensingVS from './components/FuelDispensingVS';
import ReportsMenu from './components/ReportsMenu';
import StockReport from './components/StockReport';
import FuelReceptionReport from './components/FuelReceptionReport';
import FuelReceptionAutoReport from './components/reports/FuelReceptionAutoReport';
import FuelDispensingTZAReport from './components/FuelDispensingTZAReport';
import FuelDispensingVSReport from './components/FuelDispensingVSReport';
import TrainMeasurementReport from './components/TrainMeasurementReport';
import ShiftReport from './components/ShiftReport';
import InventoryTanks from './components/InventoryTanks';
import InventoryReport from './components/InventoryReport';
import TanksConstructor from './components/TanksConstructor';
import AdminPanel from './components/AdminPanel';
import AppSettings from './components/AppSettings';
import EditLastOperation from './components/EditLastOperation';
import TelegramSettings from './components/TelegramSettings';
import Dashboard from './components/Dashboard';
import InitialSetup from './components/InitialSetup';
import InWarehouseTransfer from './components/InWarehouseTransfer';
import TankParkMap from './components/TankParkMap';
import { useToast } from './context/ToastContext';

type Page = 'start' | 'admin-panel' | 'app-settings' | 'telegram-settings' | 'dashboard' | 'workday' | 'fuel-measurement-tanks' | 'train-measurement' | 'fuel-reception' | 'fuel-reception-auto' | 'fuel-dispensing-tza' | 'fuel-dispensing-vs' | 'reports-menu' | 'stock-report' | 'fuel-reception-report' | 'fuel-reception-auto-report' | 'fuel-dispensing-tza-report' | 'fuel-dispensing-vs-report' | 'train-report' | 'senior-tech-panel' | 'shift-report' | 'inventory-tanks' | 'inventory-report' | 'tanks-constructor' | 'in-warehouse-transfer' | 'park-map';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('start');
  const [previousPage, setPreviousPage] = useState<Page>('start');
  const [currentWorkday, setCurrentWorkday] = useState<WorkdayRecord | null>(null);
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [serviceName, setServiceName] = useState('Система Автоматизации СГСМ');
  const [facilityName, setFacilityName] = useState('Международный Аэропорт "Сухум"');
  const { showToast } = useToast();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [sendingChecklist, setSendingChecklist] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncOfflineData = async () => {
    if (!isOnline) return;
    try {
      const queue = await getQueue();
      if (queue.length === 0) return;

      let hasSuccess = false;
      for (const item of queue) {
        try {
          let url = item.endpoint;
          // Очищаем от случайных полных адресов
          if (url.startsWith('http')) {
            try { url = new URL(url).pathname; } catch(e) {}
          }
          // Гарантируем наличие /api/
          if (!url.startsWith('/api/')) {
            url = url.startsWith('/') ? `/api${url}` : `/api/${url}`;
          }

          // Используем относительные пути - работает везде (локально и на Vercel)

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload),
          });
          if (response.ok) {
            await removeFromQueue(item.id);
            hasSuccess = true;
          }
        } catch (e) {
          console.error("Failed to sync item", item, e);
        }
      }
      
      if (hasSuccess) {
        showToast("Данные синхронизированы с сервером", "success");
      }
    } catch (error) {
      console.error("Sync error", error);
    }
  };

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const response = await fetch(`/api/system/setup-status`);
        if (response.ok) {
          const data = await response.json();
          setIsConfigured(data.isConfigured);
        }
      } catch (e) {
        console.error("Failed to check setup status", e);
      }
    };
    checkSetup();
  }, [refreshKey]);

  useEffect(() => {
    if (isOnline) {
      syncOfflineData();
    }
  }, [isOnline]);

  useEffect(() => {
    const loadEmployees = async () => {
      setLoadingEmployees(true);
      const data = await fetchEmployees();
      setEmployees(data);
      setLoadingEmployees(false);
    };
    loadEmployees();

    const restoreSession = async () => {
      const savedUserStr = localStorage.getItem('sgsm_saved_user');
      if (savedUserStr) {
        try {
          const user = JSON.parse(savedUserStr) as Employee;
          setCurrentUser(user);
          if (user.Role === 'Administrator' || user.Role === 'Администратор') {
            const currentView = localStorage.getItem('sgsm_current_view');
            if (currentView === 'dashboard') {
              setCurrentPage('dashboard');
            } else {
              setCurrentPage('admin-panel');
            }
          } else if (user.Role === 'Supervisor' || user.Role === 'Старший авиатехник') {
            const openShift = getOpenWorkday();
            if (openShift) {
              setCurrentWorkday({ ...openShift, Name: user.Name });
            }
            setCurrentPage('senior-tech-panel');
          } else {
            const openShift = getOpenWorkday();
            if (openShift && openShift.Name === user.Name) {
              setCurrentWorkday(openShift);
              setCurrentPage('workday');
            } else if (!openShift) {
              const newWorkday = await openWorkdayDB(user.Name);
              if (newWorkday) {
                setCurrentWorkday(newWorkday);
                setCurrentPage('workday');
              }
            }
          }
        } catch (e) {
          console.error("Failed to restore session", e);
        }
      }
    };
    restoreSession();

    const fetchLogo = async () => {
      try {
        const response = await fetch('/api/settings/logo');
        if (response.ok) {
          const data = await response.json();
          setCustomLogo(data.logo);
        }
      } catch (e) {
        console.error("Failed to fetch custom logo", e);
      }
    };
    fetchLogo();

    const fetchTexts = async () => {
      try {
        const response = await fetch('/api/settings/texts');
        if (response.ok) {
          const data = await response.json();
          if (data.service_name) setServiceName(data.service_name);
          if (data.facility_name) setFacilityName(data.facility_name);
        }
      } catch (e) {
        console.error("Failed to fetch texts", e);
      }
    };
    fetchTexts();
  }, [refreshKey]); // Чтобы при добавлении/удалении список обновлялся, хотя с заглушками пока не будет


  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved === 'dark';
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const navigateToReports = () => {
    if (!currentWorkday) {
      const openShift = getOpenWorkday();
      if (openShift) {
        setCurrentWorkday(openShift);
      }
    }
    setPreviousPage(currentPage);
    setCurrentPage('reports-menu');
  };

  const handleCloseShift = async () => {
    if (!currentWorkday) return;

    await closeWorkdayDB(currentWorkday.id);
    setCurrentWorkday(null);
    setCurrentUser(null);
    localStorage.removeItem('sgsm_saved_user');
    setCurrentPage('start');
  };

  const handleDeleteShift = () => {
    if (!currentWorkday) return;
    setShowDeleteConfirm(true);
  };

const handleSendChecklist = async () => {
    if (!currentWorkday || !currentUser) return;
    setSendingChecklist(true);
    try {
        const response = await fetch(`/api/send-checklist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workdayId: currentWorkday.id,
                employeeName: currentUser.Name,
                date: currentWorkday.Date,
            }),
        });
        if (response.ok) {
            showToast('Чек-лист успешно отправлен!', 'success');
            const updatedShift = { ...currentWorkday, Checklist_Sent: 1 };
            
            setCurrentWorkday(updatedShift);
            localStorage.setItem('currentWorkday', JSON.stringify(updatedShift));
            
            // Наш новый бронебойный флаг конкретно для ЭТОЙ даты
            localStorage.setItem(`checklist_sent_${currentWorkday.Date}`, 'true');
            
        } else {
            const err = await response.json();
            showToast(err.error || 'Ошибка отправки чек-листа', 'error');
        }
    } catch (error) {
        console.error('Send checklist error:', error);
        showToast('Ошибка соединения при отправке', 'error');
    } finally {
        setSendingChecklist(false);
    }
  };

  const confirmDeleteShift = () => {
    if (!currentWorkday) return;
    deleteWorkday(currentWorkday.id);
    setCurrentWorkday(null);
    setCurrentUser(null);
    setShowDeleteConfirm(false);
    localStorage.removeItem('sgsm_saved_user');
    setCurrentPage('start');
  };

  // Authorization logic
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedUserForAuth, setSelectedUserForAuth] = useState<Employee | null>(null);
  const [authPin, setAuthPin] = useState('');
  const [authDestination, setAuthDestination] = useState<Page | null>(null);

  const [showSeniorList, setShowSeniorList] = useState(false);
  const [showAdminList, setShowAdminList] = useState(false);

  // Delete Confirm Modal State (for shifts)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Filter employees
  const activeTechnicians = employees.filter(
    (emp) => (emp.Role === 'Avia-Technician' || emp.Role === 'Авиатехник' || emp.Role === 'Driver-AT' || emp.Role === 'Водитель/АТ') && emp.Status === 'Active'
  );

  const seniorTechs = employees.filter(
    (emp) => (emp.Role === 'Supervisor' || emp.Role === 'Старший авиатехник') && emp.Status === 'Active'
  );

  const admins = employees.filter(
    (emp) => (emp.Role === 'Administrator' || emp.Role === 'Администратор') && emp.Status === 'Active'
  );

  const handleAuthSubmit = async () => {
    if (!selectedUserForAuth) return;

    if (authPin !== selectedUserForAuth.Password && selectedUserForAuth.Password !== '') {
      showToast('Неверный пароль!', 'error');
      setAuthPin('');
      return;
    }

    // Success Auth
    setCurrentUser(selectedUserForAuth);
    localStorage.setItem('sgsm_saved_user', JSON.stringify(selectedUserForAuth));
    setShowAuthModal(false);
    setAuthPin('');
    showSeniorList && setShowSeniorList(false);
    showAdminList && setShowAdminList(false);

    if (selectedUserForAuth.Role === 'Administrator' || selectedUserForAuth.Role === 'Администратор') {
      if (authDestination === 'dashboard') {
        localStorage.setItem('sgsm_current_view', 'dashboard');
        setCurrentPage('dashboard');
      } else {
        localStorage.setItem('sgsm_current_view', 'admin');
        setCurrentPage('admin-panel');
      }
      setAuthDestination(null);
    } else if (selectedUserForAuth.Role === 'Supervisor' || selectedUserForAuth.Role === 'Старший авиатехник') {
      const openShift = getOpenWorkday();
      if (openShift) {
        // override name but keep shift id
        setCurrentWorkday({ ...openShift, Name: selectedUserForAuth.Name });
      } else {
        // no shift is fine for senior, they just get panel and can't do measurements unless shift opens, 
        // actually they can do inventory anytime
      }
      setCurrentPage('senior-tech-panel');
    } else {
      // Regular Tech
      const newWorkday = await openWorkdayDB(selectedUserForAuth.Name);
      if (newWorkday) {
        setCurrentWorkday(newWorkday);
        setCurrentPage('workday');
      }
    }

    setSelectedUserForAuth(null);
  };

  const openAuth = (user: Employee) => {
    setSelectedUserForAuth(user);
    setShowSeniorList(false);
    setShowAdminList(false);

    // Строгая проверка: Админы и Старшие обязаны вводить PIN, 
    // даже если каким-то чудом он пустой в БД. Обычные Авиатехники - нет.
    const isHighPrivilege = user.Role === 'Administrator' || user.Role === 'Администратор' || user.Role === 'Supervisor' || user.Role === 'Старший авиатехник';

    if (!user.Password && !isHighPrivilege) {
      // If no password and normal tech, just proceed as if authed
      setTimeout(() => {
        const dummyEvent = new MouseEvent('click') as any;
        document.getElementById('hidden-auth-btn')?.click();
      }, 50);
    } else {
      setShowAuthModal(true);
    }
  };

  if (isConfigured === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium animate-pulse text-sm tracking-widest uppercase">Загрузка системы...</p>
      </div>
    );
  }

  if (isConfigured === false) {
    return <InitialSetup onSetupComplete={() => {
      setIsConfigured(true);
      setRefreshKey(prev => prev + 1);
    }} />;
  }

  if (currentPage === 'workday' && currentWorkday) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col items-center pt-16 pb-20 px-4 font-sans transition-colors duration-200">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          aria-label="Toggle theme"
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {!isOnline && (
          <div className="flex items-center justify-center gap-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-4 py-2 rounded-xl mb-4 mt-2 shadow-sm w-full max-w-sm text-center">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="font-medium text-sm text-balance">Отсутствует подключение. Включен офлайн-режим</span>
          </div>
        )}

        <div className="w-full max-w-md flex flex-col items-center">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100 mb-2">
              Текущая смена:
            </h1>
            <h2 className="text-lg text-slate-700 dark:text-slate-200 font-medium">
              {currentWorkday.Name}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Дата: {currentWorkday.Date}
            </p>
          </div>

          <p className="text-base font-medium mb-5 text-slate-700 dark:text-slate-300">
            Выбор операции:
          </p>

          <div className="flex flex-col w-full sm:w-64 gap-3">
            {currentWorkday?.Checklist_Sent != 1 && localStorage.getItem(`checklist_sent_${currentWorkday?.Date}`) !== 'true' && (
            <button
              onClick={handleSendChecklist}
              disabled={sendingChecklist}
              className={`w-full text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2
                bg-red-500 hover:bg-red-600 text-white ${sendingChecklist ? 'opacity-70' : ''}`}
            >
              {sendingChecklist
                ? 'Отправка...'
                : currentWorkday.Checklist_Sent == 1
                ? 'Чек-лист отправлен'
                : 'Отправить чек-лист ЦПУ'
              }
            </button>)}
            <button
              onClick={() => setCurrentPage('fuel-measurement-tanks')}
              className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95"
            >
              Замер топлива
            </button>
            <button
              onClick={() => setCurrentPage('train-measurement')}
              className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95"
            >
              Замер ЖД-цистерны
            </button>
            <button
              onClick={() => setCurrentPage('fuel-reception')}
              className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95"
            >
              Прием топлива
            </button>
            <button
              onClick={() => setCurrentPage('fuel-dispensing-tza')}
              className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95"
            >
              Выдача в ТЗА
            </button>
            <button
              onClick={() => setCurrentPage('fuel-dispensing-vs')}
              className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95"
            >
              Выдача в ВС
            </button>
            <button
              onClick={() => setCurrentPage('fuel-reception-auto')}
              className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95"
            >
              Прием из АЦ (другое)
            </button>
            <button
              onClick={navigateToReports}
              className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95"
            >
              Отчеты/Журналы
            </button>
          </div>

          {/* Разделитель */}
          <div className="w-full max-w-xs h-px bg-slate-200 dark:bg-slate-700 my-8"></div>

          <div className="flex flex-col w-full sm:w-64 gap-3">
            <button
              onClick={() => setCurrentPage('start')}
              className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95"
            >
              На главную
            </button>
            <button
              onClick={() => setShowEditModal(true)}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center gap-2"
            >
              Последняя операция
            </button>
            <button
              onClick={handleCloseShift}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95"
            >
              Закрыть смену
            </button>
            <button
              onClick={handleDeleteShift}
              className="bg-rose-600 hover:bg-rose-700 text-white text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95"
            >
              Удалить запись о смене
            </button>
          </div>
        </div>

        {showEditModal && (
          <EditLastOperation
            workdayId={currentWorkday.id}
            onClose={() => setShowEditModal(false)}
          />
        )}

        {/* Модальное окно подтверждения удаления смены */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto">
            <div className="min-h-screen px-4 flex flex-col items-center py-8">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-xs shadow-xl my-auto text-center">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Удаление смены</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  Вы уверены, что хотите удалить запись о текущей смене? Это действие нельзя отменить.
                </p>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={confirmDeleteShift}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white font-medium py-2.5 rounded-xl transition-colors"
                  >
                    Удалить
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium py-2.5 rounded-xl transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (currentPage === 'fuel-measurement-tanks') {
    // Если смены нет, создаем "виртуальную" с ID 0, чтобы передать имя Старшего авиатехника
    const effectiveWorkday = currentWorkday || {
      id: 0,
      Name: currentUser?.Name || 'Старший авиатехник',
      Date: new Date().toLocaleDateString('ru-RU'),
      Fuel_Received_L: 0,
      Fuel_Received_KG: 0,
      Fuel_Issued_TZA_L: 0,
      Fuel_Issued_TZA_KG: 0,
      Fuel_Issued_VS_L: 0,
      Fuel_Issued_VS_KG: 0,
      Workday_Status: 'Open'
    };

    return (
      <FuelMeasurement
        currentWorkday={effectiveWorkday}
        onBack={() => {
          if (currentUser?.Role === 'Supervisor' || currentUser?.Role === 'Старший авиатехник') {
            setCurrentPage('senior-tech-panel');
          } else {
            setCurrentPage('workday');
          }
        }}
      />
    );
  }

  if (currentPage === 'train-measurement' && currentWorkday) {
    return (
      <TrainMeasurement
        currentWorkday={currentWorkday}
        onBack={() => setCurrentPage('workday')}
      />
    );
  }

  if (currentPage === 'fuel-reception' && currentWorkday) {
    return (
      <FuelReception
        currentWorkday={currentWorkday}
        onBack={() => setCurrentPage('workday')}
      />
    );
  }

  if (currentPage === 'fuel-reception-auto' && currentWorkday) {
    return (
      <FuelReceptionAuto
        currentWorkday={currentWorkday}
        onBack={() => setCurrentPage('workday')}
      />
    );
  }

  if (currentPage === 'fuel-dispensing-tza' && currentWorkday) {
    return (
      <FuelDispensingTZA
        currentWorkday={currentWorkday}
        onBack={() => setCurrentPage('workday')}
      />
    );
  }

  if (currentPage === 'fuel-dispensing-vs' && currentWorkday) {
    return (
      <FuelDispensingVS
        currentWorkday={currentWorkday}
        onBack={() => setCurrentPage('workday')}
      />
    );
  }

  if (currentPage === 'reports-menu') {
    return (
      <ReportsMenu
        currentWorkday={currentWorkday}
        onBack={() => setCurrentPage(previousPage)}
        onNavigate={(reportType) => {
          if (reportType === 'stock') {
            setCurrentPage('stock-report');
          } else if (reportType === 'reception') {
            setCurrentPage('fuel-reception-report');
          } else if (reportType === 'reception-auto') {
            setCurrentPage('fuel-reception-auto-report');
          } else if (reportType === 'dispensing-tza') {
            setCurrentPage('fuel-dispensing-tza-report');
          } else if (reportType === 'dispensing-vs') {
            setCurrentPage('fuel-dispensing-vs-report');
          } else if (reportType === 'train-report') {
            setCurrentPage('train-report');
          } else if (reportType === 'shift') {
            setCurrentPage('shift-report');
          } else {
            console.log('Navigate to report:', reportType);
            // Future implementation for specific reports
          }
        }}
      />
    );
  }

  if (currentPage === 'stock-report') {
    return (
      <StockReport
        currentWorkday={currentWorkday}
        onBack={() => setCurrentPage('reports-menu')}
      />
    );
  }

  if (currentPage === 'fuel-reception-report') {
    return (
      <FuelReceptionReport
        currentWorkday={currentWorkday}
        onBack={() => setCurrentPage('reports-menu')}
      />
    );
  }

  if (currentPage === 'fuel-reception-auto-report') {
    return (
      <FuelReceptionAutoReport
        currentWorkday={currentWorkday}
        onBack={() => setCurrentPage('reports-menu')}
      />
    );
  }

  if (currentPage === 'fuel-dispensing-tza-report') {
    return (
      <FuelDispensingTZAReport
        currentWorkday={currentWorkday}
        onBack={() => setCurrentPage('reports-menu')}
      />
    );
  }

  if (currentPage === 'fuel-dispensing-vs-report') {
    return (
      <FuelDispensingVSReport
        currentWorkday={currentWorkday}
        onBack={() => setCurrentPage('reports-menu')}
      />
    );
  }

  if (currentPage === 'train-report') {
    return (
      <TrainMeasurementReport
        currentWorkday={currentWorkday}
        onBack={() => setCurrentPage('reports-menu')}
      />
    );
  }

  if (currentPage === 'shift-report') {
    return (
      <ShiftReport
        currentWorkday={currentWorkday}
        onBack={() => setCurrentPage('reports-menu')}
      />
    );
  }

  if (currentPage === 'in-warehouse-transfer' && currentUser) {
    return (
      <InWarehouseTransfer
        currentUser={currentUser}
        currentWorkday={currentWorkday}
        onBack={() => setCurrentPage('senior-tech-panel')}
      />
    );
  }

  if (currentPage === 'senior-tech-panel') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col items-center py-12 px-4 font-sans transition-colors duration-200">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          aria-label="Toggle theme"
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {!isOnline && (
          <div className="flex items-center justify-center gap-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-4 py-2 rounded-xl mb-4 mt-2 shadow-sm w-full max-w-sm text-center">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="font-medium text-sm text-balance">Отсутствует подключение. Включен офлайн-режим</span>
          </div>
        )}

        <div className="w-full max-w-md flex flex-col items-center">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
              Старший авиатехник
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Панель управления</p>
          </div>

          <div className="w-full max-w-xs h-px bg-slate-200 dark:bg-slate-700 mb-8"></div>

          <div className="flex flex-col w-full sm:w-64 gap-3">
            <button
              onClick={() => setCurrentPage('fuel-measurement-tanks')}
              className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95"
            >
              Замер топлива
            </button>
            <button
              onClick={() => setCurrentPage('inventory-tanks')}
              className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95"
            >
              Инвентаризация
            </button>
            <button
              onClick={() => setCurrentPage('inventory-report')}
              className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95"
            >
              Отчет по инвентаризации
            </button>
            <button
               onClick={() => setCurrentPage('in-warehouse-transfer')}
               className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95"
            >
               Внутрискладская перекачка
            </button>
            <button
              onClick={navigateToReports}
              className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95"
            >
              Отчеты/Журналы
            </button>

            <button
              onClick={() => { setCurrentUser(null); localStorage.removeItem('sgsm_saved_user'); localStorage.removeItem('sgsm_current_view'); setCurrentPage('start'); }}
              className="mt-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95"
            >
              Выйти на главную
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentPage === 'inventory-tanks') {
    return (
      <InventoryTanks
        currentWorkday={currentWorkday}
        onBack={() => setCurrentPage('senior-tech-panel')}
      />
    );
  }

  if (currentPage === 'inventory-report') {
    return (
      <InventoryReport
        onBack={() => setCurrentPage('senior-tech-panel')}
      />
    );
  }

  if (currentPage === 'tanks-constructor') {
    return (
      <TanksConstructor
        onBack={() => setCurrentPage('admin-panel')}
      />
    );
  }

  if (currentPage === 'admin-panel') {
    return (
      <AdminPanel
        onBack={() => setCurrentPage('start')}
        onLogout={() => {
          setCurrentUser(null);
          localStorage.removeItem('sgsm_saved_user');
          localStorage.removeItem('sgsm_current_view');
          setCurrentPage('start');
        }}
        onNavigateToTanks={() => setCurrentPage('tanks-constructor')}
        onNavigateToSettings={() => setCurrentPage('app-settings')}
        onNavigateToTelegramSettings={() => setCurrentPage('telegram-settings')}
      />
    );
  }

  if (currentPage === 'telegram-settings') {
    return (
      <TelegramSettings
        onBack={() => setCurrentPage('admin-panel')}
      />
    );
  }

  if (currentPage === 'app-settings') {
    return (
      <AppSettings
        onBack={() => setCurrentPage('admin-panel')}
      />
    );
  }

  if (currentPage === 'dashboard') {
    return (
      <Dashboard
        onBack={() => setCurrentPage('start')}
      />
    );
  }

  if (currentPage === 'park-map') {
    return <TankParkMap onBack={() => setCurrentPage('start')} />;
  }

  const openShift = getOpenWorkday();

  return (
    <>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col items-center py-12 px-4 font-sans transition-colors duration-200">
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
        aria-label="Toggle theme"
      >
        {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Логотип */}
      <div className="mb-6 flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl flex items-center justify-center overflow-hidden shadow-sm">
          <img src={customLogo || "/logo.png"} alt="Логотип СГСМ" className="w-full h-full object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
        </div>
        <div className="text-2xl font-bold tracking-wider text-gray-900 dark:text-white mt-2 mb-1">JetMetrix System</div>
      </div>

      {/* Заголовки */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-2 text-slate-800 dark:text-slate-100">
          {serviceName}
        </h1>
        <h2 className="text-sm text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
          {facilityName}
        </h2>
      </div>

      {/* Разделитель */}
      <div className="w-full max-w-xs h-px bg-slate-200 dark:bg-slate-700 mb-8"></div>

      {/* Выбор сотрудника ИЛИ Активная смена */}
      {openShift ? (
        <div className="w-full max-w-md mb-8">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-emerald-800 dark:text-emerald-400 font-semibold">Текущая смена открыта</h3>
              <span className="bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider">Активна</span>
            </div>
            <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-1"><span className="opacity-75">Сотрудник:</span> <span className="font-medium">{openShift.Name}</span></p>
            <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-4"><span className="opacity-75">Дата:</span> <span className="font-medium">{openShift.Date}</span></p>
            <button
              onClick={() => {
                setCurrentWorkday(openShift);
                setCurrentPage('workday');
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-base font-semibold py-3.5 rounded-xl transition-all shadow-sm active:scale-95"
            >
              Вернуться к операциям смены
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-md flex flex-col items-center mb-8">
          <p className="text-base font-medium mb-5 text-slate-700 dark:text-slate-300">
            Выбор сотрудника на смене:
          </p>
          <div className="flex flex-col w-full sm:w-64 gap-3">
            {loadingEmployees ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                Загрузка списка сотрудников...
              </p>
            ) : activeTechnicians.length > 0 ? (
              activeTechnicians.map((tech) => (
                <button
                  key={tech.id}
                  onClick={() => openAuth(tech)}
                  className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95"
                >
                  {tech.Name}
                </button>
              ))
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">Нет активных сотрудников</p>
            )}
          </div>
        </div>
      )}

      {/* Разделитель */}
      <div className="w-full max-w-xs h-px bg-slate-200 dark:bg-slate-700 mb-8"></div>

      {/* Дополнительные действия */}
      <div className="w-full max-w-md flex flex-col items-center">
        <div className="flex flex-col w-full sm:w-64 gap-3">
          <button
            onClick={() => setCurrentPage('park-map')}
            className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95"
          >
            Состояние парка (Карта)
          </button>
          <button
            onClick={() => setShowSeniorList(true)}
            className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95"
          >
            Старший авиатехник
          </button>
          <button
            onClick={() => {
                setCurrentPage('dashboard');
            }}
            className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95"
          >
            Аналитика
          </button>
          <button
            onClick={() => {
              setAuthDestination('admin-panel');
              if (admins.length === 1) {
                openAuth(admins[0]);
              } else {
                setShowAdminList(true);
              }
            }}
            className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-lg font-bold py-4 px-6 rounded-xl transition-all shadow-sm active:scale-95"
          >
            Панель Администратора
          </button>
        </div>
      </div>

      {/* Hidden button for parameter-less auth */}
      <button id="hidden-auth-btn" onClick={handleAuthSubmit} className="hidden" />

      {/* Universal Auth Modal */}
      {showAuthModal && selectedUserForAuth && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-screen px-4 flex flex-col items-center py-8">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-xs shadow-xl my-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Ввод PIN-кода</h3>
                <button
                  onClick={() => {
                    setShowAuthModal(false);
                    setSelectedUserForAuth(null);
                    setAuthPin('');
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 text-center">
                Пользователь: <span className="font-medium text-slate-700 dark:text-slate-200">{selectedUserForAuth.Name}</span>
              </p>

              <input
                type="password"
                maxLength={6}
                value={authPin}
                onChange={(e) => setAuthPin(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleAuthSubmit()}
                className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-3 text-center tracking-[0.5em] text-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-6 transition-colors"
                placeholder="••••••"
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  onClick={handleAuthSubmit}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold py-3.5 rounded-lg transition-colors shadow-sm active:scale-95"
                >
                  Войти
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Senior Tech List Modal */}
      {showSeniorList && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-screen px-4 flex flex-col items-center py-8">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-xs shadow-xl my-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Старшие авиатехники</h3>
                <button onClick={() => setShowSeniorList(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {seniorTechs.length > 0 ? seniorTechs.map(tech => (
                  <button
                    key={tech.id}
                    onClick={() => openAuth(tech)}
                    className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium py-3 px-4 rounded-xl transition-all active:scale-95 text-left border border-slate-200 dark:border-slate-600"
                  >
                    {tech.Name}
                  </button>
                )) : (
                  <p className="text-sm text-slate-500 text-center py-4">Сотрудники не найдены</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin List Modal */}
      {showAdminList && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-screen px-4 flex flex-col items-center py-8">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-xs shadow-xl my-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Администраторы</h3>
                <button onClick={() => setShowAdminList(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {admins.length > 0 ? admins.map(admin => (
                  <button
                    key={admin.id}
                    onClick={() => openAuth(admin)}
                    className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-base font-semibold py-4 px-6 rounded-xl transition-all active:scale-95 text-left border border-slate-200 dark:border-slate-600"
                  >
                    {admin.Name}
                  </button>
                )) : (
                  <p className="text-sm text-slate-500 text-center py-4">Администраторы не найдены</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
