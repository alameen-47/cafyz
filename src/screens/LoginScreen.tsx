import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors, Radius, Typography, Spacing } from '../theme';
import type { Screen } from '../types';

interface LoginScreenProps {
  onNavigate: (screen: Screen) => void;
}

const PIN_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, '⌫'] as const;

export function LoginScreen({ onNavigate }: LoginScreenProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [email, setEmail] = useState('mireille@saint.paris');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState<number[]>([]);

  const handlePinKey = (key: number | '⌫' | null) => {
    if (key === null) return;
    if (key === '⌫') {
      setPin(p => p.slice(0, -1));
    } else if (pin.length < 4) {
      const next = [...pin, key];
      setPin(next);
      if (next.length === 4) {
        setTimeout(() => onNavigate('mobileOrders'), 300);
      }
    }
  };

  if (isTablet) {
    return <DesktopLogin email={email} setEmail={setEmail} password={password} setPassword={setPassword} onNavigate={onNavigate} />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.mobileRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.mobileInner}>
        {/* Header */}
        <View style={styles.mobileHeader}>
          <View style={styles.mobileLogo}>
            <Text style={styles.mobileLogoText}>C</Text>
          </View>
          <Text style={styles.mobileBrand}>Cafyz</Text>
        </View>

        {/* Welcome copy */}
        <View style={styles.mobileWelcome}>
          <Text style={styles.eyebrow}>Service · Welcome</Text>
          <Text style={styles.mobileTitle}>
            Good evening,{'\n'}
            <Text style={styles.goldItalic}>Jules.</Text>
          </Text>
          <Text style={styles.mobileSubtitle}>
            Your section is the window banquette. Service begins at 18:30.
          </Text>
        </View>

        {/* PIN field */}
        <View style={styles.pinSection}>
          <Text style={styles.pinLabel}>PIN · 4 digits</Text>
          <View style={styles.pinDots}>
            {[0, 1, 2, 3].map(i => (
              <View
                key={i}
                style={[
                  styles.pinDot,
                  pin.length > i && styles.pinDotFilled,
                ]}
              >
                {pin.length > i && <View style={styles.pinDotInner} />}
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.faceIdBtn} activeOpacity={0.7}>
          <Text style={styles.faceIdText}>👤  Use Face ID instead</Text>
        </TouchableOpacity>
      </View>

      {/* Numpad */}
      <View style={styles.numpad}>
        {PIN_KEYS.map((key, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => handlePinKey(key as any)}
            activeOpacity={0.7}
            style={[
              styles.numKey,
              key === null && styles.numKeyHidden,
            ]}
            disabled={key === null}
          >
            {key !== null && (
              <Text style={typeof key === 'number' ? styles.numKeyDigit : styles.numKeyBack}>
                {key}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </KeyboardAvoidingView>
  );
}

function DesktopLogin({
  email, setEmail, password, setPassword, onNavigate,
}: {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  onNavigate: (s: Screen) => void;
}) {
  return (
    <View style={dl.root}>
      {/* Left panel */}
      <View style={dl.left}>
        {/* Brand */}
        <View style={dl.topBrand}>
          <View style={dl.logo}>
            <Text style={dl.logoText}>C</Text>
          </View>
          <View>
            <Text style={dl.brandName}>Cafyz</Text>
            <Text style={dl.brandSub}>HOSPITALITY OS</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={dl.statsRow}>
          <Stat n="240+" l="Houses" />
          <Stat n="11" l="Countries" />
          <Stat n="99.99" l="Uptime · %" />
        </View>

        {/* Hero copy */}
        <View style={dl.heroCopy}>
          <Text style={dl.eyebrow}>Service · Mise en place</Text>
          <Text style={dl.heroTitle}>
            Run the room{'\n'}like it's{' '}
            <Text style={dl.goldItalic}>your kitchen</Text>.
          </Text>
          <Text style={dl.heroSub}>
            Cafyz is the operating system used by 240+ restaurants from Lyon to
            Tokyo — front of house, the line, and the back office in one
            tempered ecosystem.
          </Text>
        </View>

        {/* Quote card */}
        <View style={dl.quoteCard}>
          <Text style={dl.quoteText}>
            "The line moves like jazz again. We won an hour back of dinner
            service in the first month."
          </Text>
          <View style={dl.quoteAuthor}>
            <View style={dl.quoteAvatar}>
              <Text style={dl.quoteAvatarText}>HL</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={dl.quoteAuthorName}>Henri Lecomte</Text>
              <Text style={dl.quoteAuthorRole}>Chef de cuisine · Saint, Paris</Text>
            </View>
            <Text style={dl.michelinBadge}>★★ MICHELIN</Text>
          </View>
        </View>
      </View>

      {/* Right panel — sign in */}
      <ScrollView style={dl.right} contentContainerStyle={dl.rightContent}>
        <Text style={dl.eyebrow}>Sign In · Concierge</Text>
        <Text style={dl.signInTitle}>Welcome back,{'\n'}Mireille.</Text>
        <Text style={dl.signInSub}>
          Doors open at 18:30. The kitchen has flagged two reservations awaiting
          your approval.
        </Text>

        <View style={dl.fieldGroup}>
          <Text style={dl.fieldLabel}>Work email</Text>
          <TextInput
            style={dl.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={Colors.text3}
          />
        </View>

        <View style={dl.fieldGroup}>
          <View style={dl.fieldLabelRow}>
            <Text style={dl.fieldLabel}>Passphrase</Text>
            <Text style={dl.forgotLink}>Forgot</Text>
          </View>
          <TextInput
            style={dl.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••••••"
            placeholderTextColor={Colors.text2}
          />
        </View>

        <TouchableOpacity
          style={dl.signInBtn}
          onPress={() => onNavigate('manager')}
          activeOpacity={0.85}
        >
          <Text style={dl.signInBtnText}>Enter Cafyz</Text>
          <Text style={dl.signInArrow}>→</Text>
        </TouchableOpacity>

        <View style={dl.dividerRow}>
          <View style={dl.dividerLine} />
          <Text style={dl.dividerLabel}>Or</Text>
          <View style={dl.dividerLine} />
        </View>

        <View style={dl.altBtns}>
          <TouchableOpacity style={dl.altBtn} activeOpacity={0.7}>
            <Text style={dl.altBtnText}>SSO · Workspace</Text>
          </TouchableOpacity>
          <TouchableOpacity style={dl.altBtn} activeOpacity={0.7}>
            <Text style={dl.altBtnText}>Pair Device</Text>
          </TouchableOpacity>
        </View>

        <View style={dl.footer}>
          <Text style={dl.footerText}>© Cafyz Hospitality SAS · 2026</Text>
          <Text style={dl.footerMono}>v 04.2 · MICHELIN</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <View>
      <Text style={dl.statNumber}>{n}</Text>
      <Text style={dl.statLabel}>{l}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mobileRoot: {
    flex: 1,
    backgroundColor: Colors.bg0,
  },
  mobileInner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
  },
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 40,
  },
  mobileLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileLogoText: {
    fontFamily: Typography.serif,
    fontSize: 22,
    color: '#0A0A0F',
    fontWeight: '700',
  },
  mobileBrand: {
    fontFamily: Typography.serif,
    fontSize: 18,
    color: Colors.text0,
  },
  mobileWelcome: {
    marginBottom: 36,
  },
  eyebrow: {
    fontFamily: Typography.sansMedium,
    fontSize: 10,
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 10,
  },
  mobileTitle: {
    fontFamily: Typography.serif,
    fontSize: 36,
    color: Colors.text0,
    lineHeight: 42,
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  goldItalic: {
    color: Colors.gold,
    fontFamily: Typography.serifItalic,
    fontStyle: 'italic',
  },
  mobileSubtitle: {
    fontFamily: Typography.sans,
    fontSize: 13,
    color: Colors.text2,
    lineHeight: 20,
  },
  pinSection: {
    marginBottom: 22,
  },
  pinLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 10,
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  pinDots: {
    flexDirection: 'row',
    gap: 10,
  },
  pinDot: {
    flex: 1,
    height: 56,
    borderRadius: 10,
    backgroundColor: Colors.bg2,
    borderWidth: 0.5,
    borderColor: Colors.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDotFilled: {
    backgroundColor: 'rgba(201,168,76,0.1)',
    borderColor: Colors.gold,
  },
  pinDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.gold,
  },
  faceIdBtn: {
    borderWidth: 0.5,
    borderColor: Colors.line2,
    borderRadius: Radius.md,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceIdText: {
    fontFamily: Typography.sansMedium,
    fontSize: 12,
    color: Colors.text1,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  numKey: {
    width: '30%',
    aspectRatio: 1.8,
    borderRadius: 14,
    backgroundColor: Colors.bg1,
    borderWidth: 0.5,
    borderColor: Colors.goldLine,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: '1%',
  },
  numKeyHidden: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  numKeyDigit: {
    fontFamily: Typography.serif,
    fontSize: 22,
    color: Colors.text0,
    fontWeight: '500',
  },
  numKeyBack: {
    fontFamily: Typography.sans,
    fontSize: 14,
    color: Colors.text0,
  },
});

const dl = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.bg0,
  },
  left: {
    flex: 1,
    borderRightWidth: 0.5,
    borderRightColor: Colors.goldLine,
    padding: 56,
    justifyContent: 'space-between',
  },
  right: {
    flex: 0.8,
  },
  rightContent: {
    padding: 64,
    paddingBottom: 32,
  },
  topBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 40,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontFamily: Typography.serif,
    fontSize: 24,
    color: '#0A0A0F',
    fontWeight: '700',
  },
  brandName: {
    fontFamily: Typography.serif,
    fontSize: 22,
    color: Colors.text0,
    lineHeight: 24,
  },
  brandSub: {
    fontFamily: Typography.mono,
    fontSize: 10,
    color: Colors.text3,
    letterSpacing: 2,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 28,
    marginBottom: 32,
  },
  statNumber: {
    fontFamily: Typography.serif,
    fontSize: 32,
    color: Colors.gold,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 10,
    color: Colors.text2,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 6,
  },
  heroCopy: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 480,
    marginBottom: 32,
  },
  eyebrow: {
    fontFamily: Typography.sansMedium,
    fontSize: 10,
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 18,
  },
  heroTitle: {
    fontFamily: Typography.serif,
    fontSize: 48,
    color: Colors.text0,
    lineHeight: 54,
    letterSpacing: -1,
    marginBottom: 22,
  },
  goldItalic: {
    color: Colors.gold,
    fontStyle: 'italic',
  },
  heroSub: {
    fontFamily: Typography.sans,
    fontSize: 15,
    color: Colors.text2,
    lineHeight: 26,
    maxWidth: 420,
  },
  quoteCard: {
    padding: 20,
    borderWidth: 0.5,
    borderColor: Colors.goldLine,
    borderRadius: 12,
    backgroundColor: 'rgba(18,18,26,0.6)',
    maxWidth: 440,
  },
  quoteText: {
    fontFamily: Typography.serifItalic,
    fontSize: 15,
    color: Colors.text0,
    lineHeight: 24,
    fontStyle: 'italic',
    marginBottom: 14,
  },
  quoteAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quoteAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#14101a',
    borderWidth: 0.5,
    borderColor: Colors.goldLine2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteAvatarText: {
    fontFamily: Typography.serif,
    fontSize: 12,
    color: Colors.gold,
  },
  quoteAuthorName: {
    fontFamily: Typography.sansMedium,
    fontSize: 12,
    color: Colors.text0,
  },
  quoteAuthorRole: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: Colors.text2,
    marginTop: 1,
  },
  michelinBadge: {
    fontFamily: Typography.mono,
    fontSize: 10,
    color: Colors.gold,
    letterSpacing: 1,
  },
  signInTitle: {
    fontFamily: Typography.serif,
    fontSize: 40,
    color: Colors.text0,
    lineHeight: 46,
    letterSpacing: -0.8,
    marginTop: 8,
    marginBottom: 12,
  },
  signInSub: {
    fontFamily: Typography.sans,
    fontSize: 14,
    color: Colors.text2,
    lineHeight: 22,
    marginBottom: 36,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  fieldLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 11,
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  forgotLink: {
    fontFamily: Typography.sansMedium,
    fontSize: 11,
    color: Colors.text2,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  input: {
    height: 44,
    backgroundColor: Colors.bg2,
    borderWidth: 0.5,
    borderColor: Colors.line2,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    color: Colors.text0,
    fontFamily: Typography.sans,
    fontSize: 14,
  },
  signInBtn: {
    height: 56,
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 28,
    marginBottom: 24,
  },
  signInBtnText: {
    fontFamily: Typography.serif,
    fontSize: 17,
    color: '#0A0A0F',
    fontWeight: '600',
  },
  signInArrow: {
    fontSize: 16,
    color: '#0A0A0F',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: Colors.goldLine,
  },
  dividerLabel: {
    fontFamily: Typography.sansMedium,
    fontSize: 10,
    color: Colors.text3,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  altBtns: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 32,
  },
  altBtn: {
    flex: 1,
    height: 44,
    borderWidth: 0.5,
    borderColor: Colors.line2,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  altBtnText: {
    fontFamily: Typography.sansMedium,
    fontSize: 12,
    color: Colors.text1,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
  },
  footerText: {
    fontFamily: Typography.sans,
    fontSize: 11,
    color: Colors.text3,
  },
  footerMono: {
    fontFamily: Typography.mono,
    fontSize: 11,
    color: Colors.text3,
  },
});
