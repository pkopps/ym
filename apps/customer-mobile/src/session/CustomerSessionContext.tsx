import { ReactNode, createContext, useContext } from "react";
import { AuthenticatedUserEnvelope } from "@yardmatch/contracts";

export interface CustomerSessionState {
  envelope?: AuthenticatedUserEnvelope;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  biometricLabel: string;
  setBiometricEnabled: (enabled: boolean) => Promise<boolean>;
  signOut: () => void;
}

const CustomerSessionContext = createContext<CustomerSessionState>({
  envelope: undefined,
  biometricEnabled: false,
  biometricAvailable: false,
  biometricLabel: "device biometrics",
  setBiometricEnabled: async () => false,
  signOut: () => undefined
});

export function CustomerSessionProvider({
  children,
  value
}: {
  children: ReactNode;
  value: CustomerSessionState;
}) {
  return <CustomerSessionContext.Provider value={value}>{children}</CustomerSessionContext.Provider>;
}

export function useCustomerSession() {
  return useContext(CustomerSessionContext);
}
