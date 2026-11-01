import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getDepartments } from '../services/api';

const DepartmentsContext = createContext(null);

/**
 * Departments live in the database now (admin can add/edit them), replacing the
 * hard-coded DEPARTMENTS array, DEPT_ICONS, DEPT_COLORS, DEPT_ROOMS and FLOOR_MAP.
 * department = { name, label, icon, room_number, floor, description, color, max_tokens_per_day, avg_minutes_per_patient }
 */
export function DepartmentsProvider({ children }) {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setDepartments((await getDepartments()) || []);
    } catch {
      /* keep what we have */
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const value = useMemo(() => {
    const byName = Object.fromEntries(departments.map((d) => [d.name, d]));
    return { departments, byName, getDept: (n) => byName[n], loading, reload };
  }, [departments, loading, reload]);
  return <DepartmentsContext.Provider value={value}>{children}</DepartmentsContext.Provider>;
}

export const useDepartments = () => useContext(DepartmentsContext);
