import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import { BrandTokens } from "@yardmatch/branding";

export function SkeletonCard({
  label,
  lines = 3,
  showAction = false,
  showAvatar = false
}: {
  label: string;
  lines?: number;
  showAction?: boolean;
  showAvatar?: boolean;
}) {
  const opacity = useRef(new Animated.Value(0.52)).current;

  useEffect(() => {
    let isMounted = true;
    let animation: Animated.CompositeAnimation | undefined;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!isMounted || reduceMotion) {
        return;
      }

      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { duration: 720, easing: Easing.inOut(Easing.ease), toValue: 0.9, useNativeDriver: true }),
          Animated.timing(opacity, { duration: 720, easing: Easing.inOut(Easing.ease), toValue: 0.52, useNativeDriver: true })
        ])
      );
      animation.start();
    });

    return () => {
      isMounted = false;
      animation?.stop();
    };
  }, [opacity]);

  return (
    <View accessibilityLabel={label} accessibilityRole="progressbar" accessibilityState={{ busy: true }} style={styles.card}>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.content}>
        <View style={styles.header}>
          {showAvatar ? <Animated.View style={[styles.block, styles.avatar, { opacity }]} /> : null}
          <View style={styles.heading}>
            <Animated.View style={[styles.block, styles.eyebrow, { opacity }]} />
            <Animated.View style={[styles.block, styles.title, { opacity }]} />
          </View>
        </View>
        <View style={styles.body}>
          {Array.from({ length: lines }, (_, index) => (
            <Animated.View
              key={index}
              style={[styles.block, styles.line, [styles.line_1, styles.line_2, styles.line_3][index % 3], { opacity }]}
            />
          ))}
        </View>
        {showAction ? <Animated.View style={[styles.block, styles.action, { opacity }]} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BrandTokens.colors.card,
    borderColor: "rgba(20, 40, 29, 0.08)",
    borderWidth: 1,
    borderRadius: BrandTokens.radius.md,
    padding: 20
  },
  content: { gap: BrandTokens.spacing.md },
  header: { alignItems: "center", flexDirection: "row", gap: BrandTokens.spacing.md },
  heading: { flex: 1, gap: BrandTokens.spacing.sm },
  body: { gap: BrandTokens.spacing.sm },
  block: { backgroundColor: "rgba(20, 40, 29, 0.12)", borderRadius: 999 },
  avatar: { height: 52, width: 52 },
  eyebrow: { height: 10, width: "42%" },
  title: { height: 20, width: "76%" },
  line: { height: 13 },
  line_1: { width: "100%" },
  line_2: { width: "82%" },
  line_3: { width: "61%" },
  action: { height: 44, marginTop: BrandTokens.spacing.sm, width: 128 }
});
