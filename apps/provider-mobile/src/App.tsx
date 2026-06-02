import { useState } from "react";
import { SafeAreaView, StatusBar } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { AuthenticatedUserEnvelope } from "@yardmatch/contracts";
import { ProviderAuthScreen } from "./auth/ProviderAuthScreen";
import { ProviderAppNavigator } from "./navigation/ProviderAppNavigator";
import { ObservabilityProvider } from "./providers/ObservabilityProvider";
import { ProviderSessionProvider } from "./session/ProviderSessionContext";

export default function App() {
  const [sessionEnvelope, setSessionEnvelope] = useState<AuthenticatedUserEnvelope | undefined>();

  return (
    <ObservabilityProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: BrandTokens.colors.surface }}>
        <StatusBar barStyle="dark-content" />
        <ProviderSessionProvider
          value={{
            envelope: sessionEnvelope,
            signOut: () => setSessionEnvelope(undefined)
          }}
        >
          {sessionEnvelope ? (
            <ProviderAppNavigator />
          ) : (
            <ProviderAuthScreen onAuthenticated={(envelope) => setSessionEnvelope(envelope)} />
          )}
        </ProviderSessionProvider>
      </SafeAreaView>
    </ObservabilityProvider>
  );
}
