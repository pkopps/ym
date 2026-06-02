import { useState } from "react";
import { SafeAreaView, StatusBar } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { AuthenticatedUserEnvelope } from "@yardmatch/contracts";
import { CrewAuthScreen } from "./auth/CrewAuthScreen";
import { CrewAppNavigator } from "./navigation/CrewAppNavigator";
import { ObservabilityProvider } from "./providers/ObservabilityProvider";
import { CrewSessionProvider } from "./session/CrewSessionContext";

export default function App() {
  const [sessionEnvelope, setSessionEnvelope] = useState<AuthenticatedUserEnvelope | undefined>();

  return (
    <ObservabilityProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: BrandTokens.colors.surface }}>
        <StatusBar barStyle="dark-content" />
        <CrewSessionProvider
          value={{
            envelope: sessionEnvelope,
            signOut: () => setSessionEnvelope(undefined)
          }}
        >
          {sessionEnvelope ? (
            <CrewAppNavigator />
          ) : (
            <CrewAuthScreen onAuthenticated={(envelope) => setSessionEnvelope(envelope)} />
          )}
        </CrewSessionProvider>
      </SafeAreaView>
    </ObservabilityProvider>
  );
}
