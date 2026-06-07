import { useEffect, useState } from "react";
import { AppState, SafeAreaView, StatusBar } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { AuthenticatedUserEnvelope } from "@yardmatch/contracts";
import { CustomerAuthScreen } from "./auth/CustomerAuthScreen";
import { CustomerAppNavigator } from "./navigation/CustomerAppNavigator";
import { ObservabilityProvider } from "./providers/ObservabilityProvider";
import { CustomerSessionProvider } from "./session/CustomerSessionContext";

export default function App() {
  const [sessionEnvelope, setSessionEnvelope] = useState<AuthenticatedUserEnvelope | undefined>();

  useEffect(() => {
    if (!sessionEnvelope?.session.expiresAtIso) {
      return;
    }

    const signOutIfExpired = () => {
      if (Date.parse(sessionEnvelope.session.expiresAtIso) <= Date.now()) {
        setSessionEnvelope(undefined);
      }
    };

    signOutIfExpired();
    const timeout = setTimeout(signOutIfExpired, Math.max(0, Date.parse(sessionEnvelope.session.expiresAtIso) - Date.now()));
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        signOutIfExpired();
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.remove();
    };
  }, [sessionEnvelope]);

  return (
    <ObservabilityProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: BrandTokens.colors.surface }}>
        <StatusBar barStyle="dark-content" />
        <CustomerSessionProvider
          value={{
            envelope: sessionEnvelope,
            signOut: () => setSessionEnvelope(undefined)
          }}
        >
          {sessionEnvelope ? (
            <CustomerAppNavigator />
          ) : (
            <CustomerAuthScreen onAuthenticated={(envelope) => setSessionEnvelope(envelope)} />
          )}
        </CustomerSessionProvider>
      </SafeAreaView>
    </ObservabilityProvider>
  );
}
