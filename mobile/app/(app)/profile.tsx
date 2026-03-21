// ─────────────────────────────────────────────────────────────────────────────
// Profile & Settings — Identity, PIN, consent, companion sharing, sign out
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  Share,
  StyleSheet,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../lib/api';
import { useAuth } from '../_layout';
import { colors, radii, spacing } from '../../constants/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const [consentGranted, setConsentGranted] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);

  // ── Fetch profile ───────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        // TODO: Replace mock with real GET /api/tourist/profile
        const { data } = await api.get('/api/tourist/profile');
        setProfileData(data);
        setConsentGranted(!!data.insuranceConsent);
      } catch {
        // silent
      }
    })();
  }, []);

  // ── DID copy ────────────────────────────────────────────────────────────

  async function copyDID() {
    const did = profileData?.did || user?.did || 'did:fab:tourist:unknown';
    await Clipboard.setStringAsync(did);
    Toast.show({ type: 'success', text1: 'DID Copied', text2: 'Full DID copied to clipboard' });
  }

  // ── PIN Setup ───────────────────────────────────────────────────────────

  async function savePin() {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      Toast.show({ type: 'error', text1: 'Invalid PIN', text2: 'PIN must be exactly 4 digits' });
      return;
    }
    if (pin !== confirmPin) {
      Toast.show({ type: 'error', text1: 'PINs do not match', text2: 'Please enter the same PIN twice' });
      return;
    }

    setPinSaving(true);
    try {
      // TODO: Replace mock with real POST /api/tourist/set-pin
      await api.post('/api/tourist/set-pin', { pin });
      Toast.show({ type: 'success', text1: 'PIN Saved', text2: 'Use this for covert SOS activation' });
      setShowPinSetup(false);
      setPin('');
      setConfirmPin('');
    } catch {
      Toast.show({ type: 'error', text1: 'Failed', text2: 'Could not save PIN' });
    } finally {
      setPinSaving(false);
    }
  }

  // ── Insurance Consent ───────────────────────────────────────────────────

  async function toggleConsent(value: boolean) {
    setConsentLoading(true);
    try {
      // TODO: Replace mock with real POST /api/services/consent
      await api.post('/api/services/consent', {
        touristId: user?.id || profileData?.touristId,
        granted: value,
      });
      setConsentGranted(value);
      Toast.show({
        type: 'success',
        text1: value ? 'Consent Granted' : 'Consent Revoked',
        text2: value ? 'Insurance companies can access your records' : 'Access revoked',
      });
    } catch {
      Toast.show({ type: 'error', text1: 'Failed', text2: 'Could not update consent' });
    } finally {
      setConsentLoading(false);
    }
  }

  // ── Companion sharing ───────────────────────────────────────────────────

  const touristId = user?.id || profileData?.touristId || 'tourist-1';
  const shareLink = `https://safetravel.app/track/${touristId}`;

  async function copyShareLink() {
    await Clipboard.setStringAsync(shareLink);
    Toast.show({ type: 'success', text1: 'Link Copied!' });
  }

  async function shareWithCompanions() {
    try {
      await Share.share({ message: `Track my location: ${shareLink}`, url: shareLink });
    } catch {
      // user cancelled
    }
  }

  // ── Sign out ────────────────────────────────────────────────────────────

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  // ── Derived data ────────────────────────────────────────────────────────

  const displayName = profileData?.name || user?.fullName || 'Tourist';
  const displayEmail = profileData?.email || user?.email || 'test@example.com';
  const displayDID = profileData?.did || user?.did || 'did:fab:tourist:abc12345';
  const kycStatus = profileData?.kycStatus || 'pending';
  const initial = displayName.charAt(0).toUpperCase();

  const kycColor =
    kycStatus === 'verified' ? colors.green : kycStatus === 'rejected' ? colors.red : colors.amber;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={s.mainContainer}>
      <ScrollView style={s.container} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Section 1: Identity ─────────────────────────────────────────── */}
        <View style={s.profileHeader}>
          <View style={s.avatarGlow}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initial}</Text>
            </View>
          </View>
          <Text style={s.userName}>{displayName}</Text>
          <Text style={s.userEmail}>{displayEmail}</Text>

          {/* KYC status badge */}
          <TouchableOpacity onPress={() => router.push('/(app)/kyc')} activeOpacity={0.8}>
            <View
              style={[s.kycBadge, { backgroundColor: kycColor + '15', borderColor: kycColor + '40', borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }]}
            >
              <Text style={[s.kycBadgeText, { color: kycColor }]}>
                KYC STATUS: {kycStatus.toUpperCase()}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={kycColor} />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Decentralized Identity ──────────────────────────────────── */}
        <View style={s.glassCard}>
          <View style={s.sectionHeader}>
            <View style={[s.iconWrapper, { backgroundColor: colors.purple + '15' }]}>
              <Ionicons name="finger-print" size={22} color={colors.purple} />
            </View>
            <Text style={s.sectionTitle}>Decentralized Identity</Text>
          </View>

          <TouchableOpacity onPress={copyDID} style={s.didField} activeOpacity={0.7}>
            <Text style={s.didText} numberOfLines={1}>{displayDID}</Text>
            <Ionicons name="copy-outline" size={18} color={colors.primary.main} />
          </TouchableOpacity>
          <Text style={s.helperText}>Tap to copy full DID</Text>
        </View>

        {/* ── Section 2: Emergency PIN ────────────────────────────────── */}
        <View style={s.glassCard}>
          <View style={s.sectionHeader}>
            <View style={[s.iconWrapper, { backgroundColor: colors.red + '15' }]}>
              <Ionicons name="lock-closed" size={22} color={colors.red} />
            </View>
            <Text style={s.sectionTitle}>Covert SOS PIN</Text>
          </View>

          <Text style={s.sectionDesc}>
            Set a 4-digit PIN for silent emergency activation. When entered, an SOS is triggered
            without any visible indication on your device.
          </Text>

          {!showPinSetup ? (
            <TouchableOpacity onPress={() => setShowPinSetup(true)} activeOpacity={0.8}>
              <View style={s.gradientBtn}>
                <Text style={[s.pinToggleBtnText, { color: colors.red }]}>
                  {profileData?.hasPinSet ? 'Change Emergency PIN' : 'Set Emergency PIN'}
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={s.pinForm}>
              <View style={s.pinInputRow}>
                <View style={s.pinInputWrapper}>
                  <TextInput
                    style={s.pinInput}
                    value={pin}
                    onChangeText={setPin}
                    placeholder="Enter PIN"
                    placeholderTextColor={colors.text.dim}
                    keyboardType="numeric"
                    secureTextEntry
                    maxLength={4}
                  />
                </View>
                <View style={s.pinInputWrapper}>
                  <TextInput
                    style={s.pinInput}
                    value={confirmPin}
                    onChangeText={setConfirmPin}
                    placeholder="Confirm"
                    placeholderTextColor={colors.text.dim}
                    keyboardType="numeric"
                    secureTextEntry
                    maxLength={4}
                  />
                </View>
              </View>

              <View style={s.pinActions}>
                <TouchableOpacity onPress={savePin} disabled={pinSaving} style={{ flex: 1 }} activeOpacity={0.8}>
                  <View style={s.savePinSolidBtn}>
                    <Text style={s.savePinBtnText}>{pinSaving ? 'Saving...' : 'Save PIN'}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowPinSetup(false);
                    setPin('');
                    setConfirmPin('');
                  }}
                  style={s.cancelPinBtn}
                >
                  <Text style={s.cancelPinBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── Section 3: Data Sharing ───────────────────────────────── */}
        <View style={s.glassCard}>
          <View style={s.sectionHeader}>
            <View style={[s.iconWrapper, { backgroundColor: colors.primary.main + '15' }]}>
              <Ionicons name="shield-checkmark" size={22} color={colors.primary.main} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.sectionTitle}>Data & Privacy</Text>
            </View>
          </View>

          <View style={s.consentRow}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={s.consentLabel}>Insurance data sharing</Text>
              <Text style={s.consentSubtitle}>Automatically share incident data for claims</Text>
            </View>
            <Switch
              value={consentGranted}
              onValueChange={toggleConsent}
              disabled={consentLoading}
              trackColor={{ false: colors.border.medium, true: colors.primary.light }}
              thumbColor={consentGranted ? colors.primary.main : colors.surface.base}
            />
          </View>
        </View>

        {/* ── Section 4: Companion Sharing ────────────────────────────── */}
        <View style={s.glassCard}>
          <View style={s.sectionHeader}>
            <View style={[s.iconWrapper, { backgroundColor: colors.blue + '15' }]}>
              <Ionicons name="people" size={22} color={colors.blue} />
            </View>
            <Text style={s.sectionTitle}>Companions</Text>
          </View>

          <Text style={s.sectionDesc}>Share your live tracker link with family or travel companions.</Text>

          <View style={s.linkField}>
            <Text style={s.linkText} numberOfLines={1}>{shareLink}</Text>
            <TouchableOpacity onPress={copyShareLink} style={s.copyNode}>
              <Ionicons name="copy" size={16} color={colors.blue} />
            </TouchableOpacity>
          </View>

          <View style={s.companionActions}>
            <TouchableOpacity onPress={shareWithCompanions} style={{ flex: 1 }} activeOpacity={0.8}>
               <View style={s.shareLinkBtn}>
                <Ionicons name="share-outline" size={18} color={colors.blue} />
                <Text style={s.shareLinkBtnText}>Share Link</Text>
              </View>
            </TouchableOpacity>
            <View style={s.companionCountBadge}>
              <View style={s.activeDot} />
              <Text style={s.companionCountText}>2 Active</Text>
            </View>
          </View>
        </View>

        {/* ── Section 5: Sign Out ─────────────────────────────────────── */}
        <TouchableOpacity onPress={handleSignOut} activeOpacity={0.7} style={{ marginTop: 16 }}>
          <View style={s.signOutBtn}>
            <Ionicons name="log-out-outline" size={20} color={colors.text.secondary} />
            <Text style={s.signOutText}>Secure Sign Out</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: colors.surface.lowest },
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 80 },

  // Profile header
  profileHeader: { alignItems: 'center', marginBottom: 24, marginTop: 16 },
  avatarGlow: {
    padding: 4,
    borderRadius: 50,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary.container,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: colors.primary.main },
  userName: { fontSize: 24, fontWeight: '700', color: colors.text.primary, letterSpacing: -0.5 },
  userEmail: { fontSize: 14, color: colors.text.secondary, marginTop: 4 },
  kycBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
  },
  kycBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  // Cards
  glassCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border.medium,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text.primary, letterSpacing: -0.2 },
  sectionDesc: { fontSize: 13, color: colors.text.secondary, lineHeight: 20, marginBottom: 16 },
  helperText: { fontSize: 12, color: colors.text.dim, marginTop: 8 },

  // DID field
  didField: {
    backgroundColor: colors.surface.lowest,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  didText: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.text.primary,
    flex: 1,
  },

  // PIN
  gradientBtn: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.medium,
    backgroundColor: colors.surface.lowest,
  },
  pinToggleBtnText: { fontWeight: '600', fontSize: 14 },
  pinForm: { marginTop: 4 },
  pinInputRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  pinInputWrapper: {
    flex: 1,
    backgroundColor: colors.surface.lowest,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  pinInput: {
    padding: 16,
    textAlign: 'center',
    fontSize: 22,
    letterSpacing: 8,
    color: colors.text.primary,
    fontWeight: '700',
  },
  pinActions: { flexDirection: 'row', gap: 12 },
  savePinSolidBtn: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    backgroundColor: colors.red,
  },
  savePinBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 15 },
  cancelPinBtn: {
    flex: 1,
    backgroundColor: colors.surface.lowest,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  cancelPinBtnText: { color: colors.text.secondary, fontWeight: '600', fontSize: 15 },

  // Consent
  consentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface.lowest, padding: 16, borderRadius: 10, borderWidth: 1, borderColor: colors.border.medium },
  consentLabel: { fontSize: 15, fontWeight: '600', color: colors.text.primary, marginBottom: 4 },
  consentSubtitle: { fontSize: 13, color: colors.text.secondary },

  // Companion sharing
  linkField: {
    backgroundColor: colors.surface.lowest,
    borderRadius: 10,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  linkText: {
    fontSize: 12,
    color: colors.text.secondary,
    flex: 1,
  },
  copyNode: {
    padding: 8,
    backgroundColor: colors.primary.container,
    borderRadius: 8,
  },
  companionActions: { flexDirection: 'row', gap: 12 },
  shareLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: 10,
    padding: 12,
    backgroundColor: colors.surface.lowest,
  },
  shareLinkBtnText: { color: colors.blue, fontWeight: '600', fontSize: 14 },
  companionCountBadge: {
    flex: 0.8,
    flexDirection: 'row',
    backgroundColor: colors.surface.lowest,
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  companionCountText: { fontSize: 13, color: colors.text.secondary, fontWeight: '600' },

  // Sign out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border.medium,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  signOutText: { color: colors.text.secondary, fontWeight: '600', fontSize: 15 },
});

