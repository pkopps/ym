import { useState } from "react";
import { SafeAreaView, StatusBar } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { CrewAuthScreen } from "./auth/CrewAuthScreen";
import { CrewAppNavigator } from "./navigation/CrewAppNavigator";
import { ObservabilityProvider } from "./providers/ObservabilityProvider";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <ObservabilityProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: BrandTokens.colors.surface }}>
        <StatusBar barStyle="dark-content" />
        {isAuthenticated ? (
          <CrewAppNavigator />
        ) : (
          <CrewAuthScreen onAuthenticated={() => setIsAuthenticated(true)} />
        )}
      </SafeAreaView>
    </ObservabilityProvider>
  );
}
