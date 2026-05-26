import { SafeAreaView, StatusBar } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { AppNavigator } from "./navigation/AppNavigator";
import { ObservabilityProvider } from "./providers/ObservabilityProvider";

export default function App() {
  return (
    <ObservabilityProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: BrandTokens.colors.surface }}>
        <StatusBar barStyle="dark-content" />
        <AppNavigator />
      </SafeAreaView>
    </ObservabilityProvider>
  );
}
