import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { BrandTokens } from "@yardmatch/branding";
import { AuthFlowMode } from "@yardmatch/contracts";

function getModeCopy(mode: AuthFlowMode) {
  return mode === "login"
    ? {
        eyebrow: "Customer login",
        title: "Welcome back.",
        description: "Log in to manage bookings, saved properties, and reviews.",
        submitLabel: "Log in"
      }
    : {
        eyebrow: "Customer sign up",
        title: "Book local lawn care faster.",
        description: "Start with email and password. Property details come after account creation.",
        submitLabel: "Create account"
      };
}

export function CustomerAuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<AuthFlowMode>("login");
  const authCopy = getModeCopy(mode);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{authCopy.eyebrow}</Text>
        <Text style={styles.title}>{authCopy.title}</Text>
        <Text style={styles.description}>{authCopy.description}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.modeRow}>
          {(["login", "signup"] as const).map((value) => {
            const isActive = value === mode;
            return (
              <Pressable
                key={value}
                onPress={() => setMode(value)}
                style={[styles.modeButton, isActive && styles.modeButtonActive]}
              >
                <Text style={[styles.modeLabel, isActive && styles.modeLabelActive]}>
                  {value === "login" ? "Log in" : "Sign up"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.fieldStack}>
          <TextInput placeholder="customer@example.com" placeholderTextColor="#6e7d71" style={styles.input} />
          <TextInput placeholder="Password" placeholderTextColor="#6e7d71" secureTextEntry style={styles.input} />
        </View>

        <Pressable onPress={onAuthenticated} style={styles.primaryButton}>
          <Text style={styles.primaryButtonLabel}>{authCopy.submitLabel}</Text>
        </Pressable>

        <View style={styles.socialStack}>
          <Pressable onPress={onAuthenticated} style={styles.socialButton}>
            <AntDesign color="#4285F4" name="google" size={18} />
            <Text style={styles.socialLabel}>Continue with Google</Text>
          </Pressable>
          <Pressable onPress={onAuthenticated} style={styles.socialButton}>
            <AntDesign color={BrandTokens.colors.ink} name="apple" size={18} />
            <Text style={styles.socialLabel}>Continue with Apple</Text>
          </Pressable>
        </View>

        <Text style={styles.helper}>Property address, service notes, and payment setup come after sign in.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: BrandTokens.spacing.hero,
    gap: BrandTokens.spacing.xl,
    backgroundColor: BrandTokens.colors.surface
  },
  hero: {
    gap: BrandTokens.spacing.md
  },
  eyebrow: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  title: {
    color: BrandTokens.colors.ink,
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 38
  },
  description: {
    color: BrandTokens.colors.inkSoft,
    fontSize: 16,
    lineHeight: 24
  },
  card: {
    gap: BrandTokens.spacing.lg,
    borderRadius: BrandTokens.radius.md,
    borderWidth: 1,
    borderColor: "rgba(20, 40, 29, 0.08)",
    backgroundColor: BrandTokens.colors.card,
    padding: BrandTokens.spacing.xl
  },
  modeRow: {
    flexDirection: "row",
    gap: BrandTokens.spacing.sm
  },
  modeButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    paddingVertical: BrandTokens.spacing.sm,
    backgroundColor: "rgba(255,255,255,0.85)"
  },
  modeButtonActive: {
    backgroundColor: BrandTokens.colors.primary,
    borderColor: BrandTokens.colors.primary
  },
  modeLabel: {
    color: BrandTokens.colors.primaryStrong,
    fontWeight: "700"
  },
  modeLabelActive: {
    color: "#ffffff"
  },
  fieldStack: {
    gap: BrandTokens.spacing.md
  },
  input: {
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    borderRadius: 16,
    paddingHorizontal: BrandTokens.spacing.lg,
    paddingVertical: BrandTokens.spacing.md,
    backgroundColor: "rgba(255,255,255,0.96)",
    color: BrandTokens.colors.ink
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: BrandTokens.colors.primary
  },
  primaryButtonLabel: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16
  },
  socialStack: {
    gap: BrandTokens.spacing.md
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: BrandTokens.spacing.sm,
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BrandTokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.96)"
  },
  socialLabel: {
    color: BrandTokens.colors.ink,
    fontWeight: "700"
  },
  helper: {
    color: BrandTokens.colors.inkSoft,
    lineHeight: 22
  }
});
