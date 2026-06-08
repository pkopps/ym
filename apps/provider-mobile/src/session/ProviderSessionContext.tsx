import { ReactNode, createContext, useContext } from "react";
import { AuthenticatedUserEnvelope } from "@yardmatch/contracts";

export interface ProviderSessionState {
  envelope?: AuthenticatedUserEnvelope;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  biometricLabel: string;
  setBiometricEnabled: (enabled: boolean) => Promise<boolean>;
  signOut: () => void;
}

const ProviderSessionContext = createContext<ProviderSessionState>({
  envelope: undefined,
  biometricEnabled: false,
  biometricAvailable: false,
  biometricLabel: "device biometrics",
  setBiometricEnabled: async () => false,
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
