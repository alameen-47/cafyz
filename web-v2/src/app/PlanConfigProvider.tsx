import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  getCachedPlanConfigs,
  PLAN_CONFIG_UPDATED,
  refreshPlanConfigs,
} from '../services/planConfigStore';
import type { ApiPlanConfig } from '../services/api';

const REFRESH_MS = 5 * 60 * 1000;

interface PlanConfigContextValue {
  plans: ApiPlanConfig[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const PlanConfigContext = createContext<PlanConfigContextValue>({
  plans: [],
  loading: true,
  refresh: async () => {},
});

export function PlanConfigProvider({ children }: { children: ReactNode }) {
  const [plans, setPlans] = useState<ApiPlanConfig[]>(() => getCachedPlanConfigs() ?? []);
  const [loading, setLoading] = useState(!getCachedPlanConfigs());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setPlans(await refreshPlanConfigs(true));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPlanConfigs().then(setPlans).finally(() => setLoading(false));

    const onUpdate = () => setPlans(getCachedPlanConfigs() ?? []);
    window.addEventListener(PLAN_CONFIG_UPDATED, onUpdate);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshPlanConfigs(true).then(setPlans);
    };
    document.addEventListener('visibilitychange', onVisible);

    const timer = window.setInterval(() => { void refreshPlanConfigs(true).then(setPlans); }, REFRESH_MS);

    return () => {
      window.removeEventListener(PLAN_CONFIG_UPDATED, onUpdate);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, []);

  return (
    <PlanConfigContext.Provider value={{ plans, loading, refresh }}>
      {children}
    </PlanConfigContext.Provider>
  );
}

export function usePlanConfig() {
  return useContext(PlanConfigContext);
}
