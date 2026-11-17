import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";
import { useI18n } from "@yardmatch/i18n/react";

/** Keeps a crashed screen from leaving providers on a blank white app. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  public override state = { failed: false };

  public static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Provider app screen crashed", error, info.componentStack);
  }

  public override render(): ReactNode {
    return this.state.failed
      ? <AppErrorScreen onRetry={() => this.setState({ failed: false })} />
      : this.props.children;
  }
}

function AppErrorScreen({ onRetry }: { onRetry: () => void }) {
  const i18n = useI18n();
  return (
    <View accessibilityRole="alert" style={styles.shell}>
      <Text accessibilityRole="header" style={styles.title}>{i18n.t("app_error.title")}</Text>
      <Text style={styles.body}>{i18n.t("app_error.body_mobile")}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.button}>
        <Text style={styles.buttonLabel}>{i18n.t("app_error.retry")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: BrandTokens.spacing.md,
    paddingHorizontal: BrandTokens.spacing.xl,
    backgroundColor: BrandTokens.colors.surface
  },
  title: {
    color: BrandTokens.colors.ink,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center"
  },
  body: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center"
  },
  button: {
    backgroundColor: BrandTokens.colors.primary,
    borderRadius: BrandTokens.radius.md,
    paddingHorizontal: BrandTokens.spacing.xl,
    paddingVertical: BrandTokens.spacing.md
  },
  buttonLabel: {
    color: "#ffffff",
    fontWeight: "700"
  }
});
