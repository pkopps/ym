import { SafeAreaView, StatusBar } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { ProviderAppNavigator } from "./navigation/ProviderAppNavigator";
import { ObservabilityProvider } from "./providers/ObservabilityProvider";

export default function App() {
  return (
    <ObservabilityProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: BrandTokens.colors.surface }}>
        <StatusBar barStyle="dark-content" />
        <ProviderAppNavigator />
      </SafeAreaView>
    </ObservabilityProvider>
  );
}
