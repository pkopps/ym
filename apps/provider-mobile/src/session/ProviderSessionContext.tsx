import { ReactNode, createContext, useContext } from "react";
import { AuthenticatedUserEnvelope } from "@yardmatch/contracts";

export interface ProviderSessionState {
  envelope?: AuthenticatedUserEnvelope;
  signOut: () => void;
}

const ProviderSessionContext = createContext<ProviderSessionState>({
  envelope: undefined,
  signOut: () => undefined
});

export function ProviderSessionProvider({
  children,
  value
}: {
  children: ReactNode;
  value: ProviderSessionState;
}) {
  return <ProviderSessionContext.Provider value={value}>{children}</ProviderSessionContext.Provider>;
}

export function useProviderSession() {
  return useContext(ProviderSessionContext);
}
