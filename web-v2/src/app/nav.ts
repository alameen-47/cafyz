import { createContext, useContext } from "react";

// Lightweight cross-screen navigation intent: lets the Table Map open the POS
// pre-loaded for a specific table ("select table → take order").
export interface AppNav {
  goToTableOrder: (tableId: string) => void;
  goToPos: () => void;
  goToPage: (page: string) => void;
  posTableId: string | null;
  clearPosTable: () => void;
}

export const NavContext = createContext<AppNav>({
  goToTableOrder: () => {},
  goToPos: () => {},
  goToPage: () => {},
  posTableId: null,
  clearPosTable: () => {},
});

export const useAppNav = () => useContext(NavContext);
