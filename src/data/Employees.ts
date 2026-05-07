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
    const response = await fetch('/api/employees');
    if (!response.ok) {
      console.error(`API /api/employees вернул ${response.status}`);
      return [];
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Ошибка при загрузке сотрудников:", error);
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
