export type EmployeeRole = 'Avia-Technician' | 'Supervisor' | 'Administrator' | 'Driver-AT';
export type EmployeeStatus = 'Active' | 'Deleted';

export interface Employee {
  id: number;
  Date: string;
  Name: string;
  Role: string;
  Status: string;
  Password: string;
  Archive_Date?: string;
}

export const fetchEmployees = async (): Promise<Employee[]> => {
  try {
    console.log("1. Отправляем запрос Диспетчеру на порт 3001...");
    const response = await fetch('/api/employees');
    const data = await response.json();
    console.log("2. Получили данные из Сейфа:", data);
    return data;
  } catch (error) {
    console.error("❌ Ошибка связи с Диспетчером:", error);
    return [];
  }
};

// Заглушки, чтобы не сломать App.tsx, до тех пор, пока бэкенд не будет поддерживать добавление/удаление
export const addEmployee = async (name: string, role: EmployeeRole, password?: string) => {
  console.log('addEmployee called, needs backend implementation');
  return null;
};

export const deleteEmployee = async (id: number) => {
  console.log('deleteEmployee called, needs backend implementation');
  return false;
};
