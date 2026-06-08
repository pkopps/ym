import { ReactNode, createContext, useContext } from "react";
import { AuthenticatedUserEnvelope } from "@yardmatch/contracts";

export interface CrewSessionState {
  envelope?: AuthenticatedUserEnvelope;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  biometricLabel: string;
  setBiometricEnabled: (enabled: boolean) => Promise<boolean>;
  signOut: () => void;
}

const CrewSessionContext = createContext<CrewSessionState>({
  envelope: undefined,
  biometricEnabled: false,
  biometricAvailable: false,
  biometricLabel: "device biometrics",
  setBiometricEnabled: async () => false,
  signOut: () => undefined
});

export function CrewSessionProvider({
  children,
  value
}: {
  children: ReactNode;
  value: CrewSessionState;
}) {
  return <CrewSessionContext.Provider value={value}>{children}</CrewSessionContext.Provider>;
}

export function useCrewSession() {
  return useContext(CrewSessionContext);
}
