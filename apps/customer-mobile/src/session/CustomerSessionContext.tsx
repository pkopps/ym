import { ReactNode, createContext, useContext } from "react";
import { AuthenticatedUserEnvelope } from "@yardmatch/contracts";

export interface CustomerSessionState {
  envelope?: AuthenticatedUserEnvelope;
  signOut: () => void;
}

const CustomerSessionContext = createContext<CustomerSessionState>({
  envelope: undefined,
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
