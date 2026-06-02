import { ReactNode, createContext, useContext } from "react";
import { AuthenticatedUserEnvelope } from "@yardmatch/contracts";

export interface CrewSessionState {
  envelope?: AuthenticatedUserEnvelope;
  signOut: () => void;
}

const CrewSessionContext = createContext<CrewSessionState>({
  envelope: undefined,
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
