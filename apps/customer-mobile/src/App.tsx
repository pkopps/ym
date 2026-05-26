import { useState } from "react";
import { SafeAreaView, StatusBar } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { CustomerAuthScreen } from "./auth/CustomerAuthScreen";
import { CustomerAppNavigator } from "./navigation/CustomerAppNavigator";
import { ObservabilityProvider } from "./providers/ObservabilityProvider";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <ObservabilityProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: BrandTokens.colors.surface }}>
        <StatusBar barStyle="dark-content" />
        {isAuthenticated ? (
          <CustomerAppNavigator />
        ) : (
          <CustomerAuthScreen onAuthenticated={() => setIsAuthenticated(true)} />
        )}
      </SafeAreaView>
    </ObservabilityProvider>
  );
}
