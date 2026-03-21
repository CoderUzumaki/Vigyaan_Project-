// ─────────────────────────────────────────────────────────────────────────────
// KYC Submission Flow — Identity verification with passport + selfie capture
// Uses expo-camera for photo capture, expo-image-picker for gallery fallback
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../lib/api';
import type { KYCStep } from '../../types';
import { colors, radii, spacing } from '../../constants/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
// ID card aspect ratio guide
const CARD_ASPECT = 1.586;
const GUIDE_W = SCREEN_W * 0.8;
const GUIDE_H = GUIDE_W / CARD_ASPECT;
// Selfie oval
const OVAL_W = 220;
const OVAL_H = 300;

export default function KYCScreen() {
  const router = useRouter();
  const [step, setStep] = useState<KYCStep>('instructions');
  const [passportUri, setPassportUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // ── Take photo with camera ──────────────────────────────────────────────

  async function capturePhoto() {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!photo) return;

      if (step === 'passport_capture') {
        setPassportUri(photo.uri);
      } else if (step === 'selfie_capture') {
        setSelfieUri(photo.uri);
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Capture Failed', text2: 'Please try again' });
    }
  }

  // ── Pick from gallery ───────────────────────────────────────────────────

  async function pickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      if (step === 'passport_capture') {
        setPassportUri(result.assets[0].uri);
      } else if (step === 'selfie_capture') {
        setSelfieUri(result.assets[0].uri);
      }
    }
  }

  // ── Start verification (request camera permission) ──────────────────────

  async function startVerification() {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        Toast.show({ type: 'error', text1: 'Camera Required', text2: 'Camera is needed for KYC' });
        return;
      }
    }
    setStep('passport_capture');
  }

  // ── Submit KYC ──────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!passportUri || !selfieUri) return;
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('passportPhoto', {
        uri: passportUri,
        name: 'passport.jpg',
        type: 'image/jpeg',
      } as any);
      formData.append('selfie', {
        uri: selfieUri,
        name: 'selfie.jpg',
        type: 'image/jpeg',
      } as any);

      // TODO: Replace mock with real POST /api/kyc/submit
      const { data } = await api.post('/api/kyc/submit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSubmissionId(data.submissionId);
      setStep('submitted');
      Toast.show({ type: 'success', text1: 'KYC Submitted!', text2: 'Pending admin review' });
    } catch {
      Toast.show({ type: 'error', text1: 'Submission Failed', text2: 'Please try again' });
    } finally {
      setSubmitting(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // RENDER: Instructions (Step 1)
  // ────────────────────────────────────────────────────────────────────────

  if (step === 'instructions') {
    return (
      <View style={s.mainContainer}>
        <ScrollView style={s.container} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header icon */}
          <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 24 }}>
            <View style={s.headerIconGlow}>
              <View style={s.headerIcon}>
                <Ionicons name="shield-checkmark" size={40} color={colors.primary.main} />
              </View>
            </View>
            <Text style={s.title}>Identity Verification</Text>
            <Text style={s.subtitle}>Complete KYC to unlock all safety features</Text>
          </View>

          {/* Step cards */}
          <View style={s.stepsContainer}>
            {[
              { icon: 'card-outline' as const, title: 'Passport / ID Photo', desc: 'Take a clear photo of your government-issued ID', num: '1' },
              { icon: 'camera-outline' as const, title: 'Selfie', desc: 'Take a selfie to match against your document', num: '2' },
              { icon: 'cloud-upload-outline' as const, title: 'Submit', desc: 'Review and send for admin verification', num: '3' },
            ].map((item) => (
              <View key={item.num} style={s.glassCard}>
                <View style={s.stepCardInner}>
                  <View style={s.stepIconWrap}>
                    <Ionicons name={item.icon} size={24} color={colors.primary.main} />
                  </View>
                  <View style={s.stepContent}>
                    <Text style={s.stepTitle}>{item.title}</Text>
                    <Text style={s.stepDesc}>{item.desc}</Text>
                  </View>
                  <Text style={s.stepNum}>{item.num}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Accepted documents */}
          <View style={s.glassCard}>
            <View style={{ padding: 16 }}>
              <Text style={s.acceptedLabel}>Accepted documents:</Text>
              {['Passport', 'National ID Card', 'Driving License'].map((doc) => (
                <View key={doc} style={s.docItem}>
                  <View style={s.docDot} />
                  <Text style={s.docText}>{doc}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Start button */}
          <TouchableOpacity onPress={startVerification} activeOpacity={0.8} style={{ marginTop: 12 }}>
            <View style={s.primaryBtnGlow}>
              <Text style={s.primaryBtnText}>Start Verification</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // RENDER: Camera capture (Step 2 — Passport / Step 3 — Selfie)
  // ────────────────────────────────────────────────────────────────────────

  const isPassport = step === 'passport_capture';
  const isSelfie = step === 'selfie_capture';
  const capturedUri = isPassport ? passportUri : selfieUri;
  const isPreview = capturedUri !== null;

  if (isPassport || isSelfie) {
    // ── Preview captured image ──
    if (isPreview) {
      return (
        <View style={s.container}>
          <Image source={{ uri: capturedUri }} style={s.previewImage} resizeMode="contain" />
          <View style={s.previewControls}>
            <TouchableOpacity
              onPress={() => {
                if (isPassport) setPassportUri(null);
                else setSelfieUri(null);
              }}
              style={s.retakeBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={20} color={colors.text.primary} />
              <Text style={s.retakeBtnText}>Retake</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (isPassport) setStep('selfie_capture');
                else setStep('review');
              }}
              activeOpacity={0.8}
            >
              <View style={s.usePhotoBtn}>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={s.usePhotoBtnText}>Use this photo</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // ── Live camera ──
    return (
      <View style={s.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={s.camera}
          facing={isPassport ? 'back' : 'front'}
        />

        {/* Close button */}
        <TouchableOpacity
          onPress={() => setStep(isPassport ? 'instructions' : 'passport_capture')}
          style={s.closeBtn}
        >
          <View style={s.iconBlurBg}>
             <Ionicons name="close" size={24} color="#000" />
          </View>
        </TouchableOpacity>

        {/* Guide overlay */}
        <View style={s.guideOverlay} pointerEvents="none">
          {isPassport ? (
            <View style={s.idGuide}>
              <View style={s.guideLabelBg}>
                <Text style={s.guideTextOverlay}>Align your document within the frame</Text>
              </View>
            </View>
          ) : (
            <View style={s.selfieGuide}>
               <View style={s.guideLabelBg}>
                  <Text style={s.guideTextOverlay}>Position your face within the oval</Text>
               </View>
            </View>
          )}
        </View>

        {/* Bottom camera controls */}
        <View style={s.cameraControls}>
          {/* Gallery */}
          <TouchableOpacity onPress={pickFromGallery} style={s.cameraSecondary}>
            <Ionicons name="images" size={28} color="rgba(0,0,0,0.7)" />
          </TouchableOpacity>

          {/* Capture */}
          <TouchableOpacity onPress={capturePhoto} style={s.captureBtn} activeOpacity={0.7}>
            <View style={s.captureBtnInner} />
            <View style={s.captureBtnRing} />
          </TouchableOpacity>

          {/* Spacer to balance the layout */}
          <View style={s.cameraSecondary}>
            <Ionicons name="camera-reverse-outline" size={28} color="rgba(0,0,0,0.7)" />
          </View>
        </View>
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // RENDER: Review & Submit (Step 4)
  // ────────────────────────────────────────────────────────────────────────

  if (step === 'review') {
    return (
      <View style={s.mainContainer}>
        <ScrollView style={s.container} contentContainerStyle={s.scrollContent}>
          <Text style={[s.title, { marginTop: 20 }]}>Review & Submit</Text>
          <Text style={s.subtitle}>Verify your photos before submitting</Text>

          {/* Images side by side */}
          <View style={s.imageRow}>
            <View style={s.imageCol}>
              <Text style={s.imageLabel}>Passport / ID</Text>
              <View style={s.reviewImageGlowWrapper}>
                {passportUri && (
                  <Image source={{ uri: passportUri }} style={s.reviewImage} resizeMode="cover" />
                )}
              </View>
              <TouchableOpacity
                onPress={() => { setPassportUri(null); setStep('passport_capture'); }}
                style={s.retakeLinkHitbox}
              >
                <Text style={s.retakeLink}>Retake</Text>
              </TouchableOpacity>
            </View>

            <View style={s.imageCol}>
              <Text style={s.imageLabel}>Selfie</Text>
              <View style={s.reviewImageGlowWrapper}>
                {selfieUri && (
                  <Image source={{ uri: selfieUri }} style={s.reviewImage} resizeMode="cover" />
                )}
              </View>
              <TouchableOpacity
                onPress={() => { setSelfieUri(null); setStep('selfie_capture'); }}
                style={s.retakeLinkHitbox}
              >
                <Text style={s.retakeLink}>Retake</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
            style={{ marginTop: 20 }}
          >
            <View 
              style={[s.primaryBtnGlow, submitting && s.btnDisabled]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryBtnText}>Submit for Verification</Text>
              )}
            </View>
          </TouchableOpacity>

          {/* Start over */}
          <TouchableOpacity
            onPress={() => {
              setPassportUri(null);
              setSelfieUri(null);
              setStep('instructions');
            }}
            style={s.startOverBtn}
          >
            <Text style={s.startOverText}>Cancel & Start Over</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // RENDER: Submitted confirmation
  // ────────────────────────────────────────────────────────────────────────

  return (
    <View style={s.centerContainer}>
      <View style={s.successIconGlow}>
        <View style={s.successIcon}>
          <Ionicons name="checkmark-circle" size={56} color={colors.green} />
        </View>
      </View>
      
      <Text style={[s.title, { fontSize: 26 }]}>KYC Submitted!</Text>
      <Text style={s.subtitle}>
        Your identity verification documents have been securely submitted. An admin will review them shortly.
      </Text>
      
      {submissionId && (
        <View style={s.submissionBox}>
          <Text style={s.submissionIdText}>SUBMISSION ID</Text>
          <Text style={s.monospace}>{submissionId}</Text>
        </View>
      )}
      
      <TouchableOpacity
        onPress={() => router.replace('/(app)')}
        activeOpacity={0.8}
        style={{ width: '100%', marginTop: 32 }}
      >
         <View style={s.backToHomeBtn}>
           <Text style={s.backToHomeText}>Back to Home</Text>
         </View>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: colors.surface.lowest },
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60 },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.surface.lowest,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  // Header
  headerIconGlow: {
    padding: 8,
    borderRadius: 60,
    marginBottom: 16,
    backgroundColor: colors.primary.container,
  },
  headerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },

  // Step cards
  stepsContainer: { gap: 12, marginBottom: 24 },
  glassCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.medium,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  stepCardInner: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary.container,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary, marginBottom: 4 },
  stepDesc: { fontSize: 13, color: colors.text.secondary, lineHeight: 18 },
  stepNum: { fontSize: 18, color: colors.border.outline, fontWeight: '700', marginLeft: 8 },

  // Accepted docs
  acceptedLabel: { fontSize: 14, fontWeight: '700', color: colors.text.primary, marginBottom: 12 },
  docItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  docDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary.main, marginRight: 12 },
  docText: { fontSize: 14, color: colors.text.secondary },

  // Primary button
  primaryBtnGlow: {
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    backgroundColor: colors.primary.main,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  btnDisabled: { opacity: 0.6 },

  // Camera
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  iconBlurBg: {
    padding: 10,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  guideOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  idGuide: {
    width: GUIDE_W,
    height: GUIDE_H,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderStyle: 'dashed',
    borderRadius: 16,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  selfieGuide: {
    width: OVAL_W,
    height: OVAL_H,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderStyle: 'dashed',
    borderRadius: OVAL_W / 2,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  guideLabelBg: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: -40,
  },
  guideTextOverlay: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  cameraControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 20,
  },
  cameraSecondary: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  captureBtn: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBtnRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  captureBtnInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
  },

  // Preview
  previewImage: { flex: 1, backgroundColor: '#000' },
  previewControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 30,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: colors.border.medium,
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: colors.surface.lowest,
    borderWidth: 1,
    borderColor: colors.border.outline,
  },
  retakeBtnText: { color: colors.text.primary, marginLeft: 8, fontWeight: '700' },
  usePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: colors.primary.main,
  },
  usePhotoBtnText: { color: '#ffffff', marginLeft: 8, fontWeight: '700' },

  // Review step
  imageRow: { flexDirection: 'row', gap: 16, marginBottom: 32 },
  imageCol: { flex: 1, alignItems: 'center' },
  imageLabel: { fontSize: 14, color: colors.text.primary, marginBottom: 12, fontWeight: '700' },
  reviewImageGlowWrapper: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    padding: 2,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border.medium,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reviewImage: { width: '100%', height: '100%', borderRadius: 14 },
  retakeLinkHitbox: { padding: 12, marginTop: 4 },
  retakeLink: { fontSize: 14, color: colors.primary.main, fontWeight: '700' },
  startOverBtn: { padding: 16, alignItems: 'center', marginTop: 12 },
  startOverText: { color: colors.text.secondary, fontSize: 14, fontWeight: '600' },

  // Submitted
  successIconGlow: {
    padding: 6,
    borderRadius: 60,
    marginBottom: 24,
    backgroundColor: '#e6f4ea', // Google Green light
  },
  successIcon: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  submissionBox: {
    backgroundColor: colors.surface.lowest,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: colors.border.medium,
    alignItems: 'center',
    width: '100%',
  },
  submissionIdText: {
    fontSize: 10,
    color: colors.text.dim,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  monospace: { 
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', 
    color: colors.text.secondary,
    fontSize: 15,
  },
  backToHomeBtn: {
    padding: 16,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.outline,
    backgroundColor: '#ffffff',
  },
  backToHomeText: {
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 16,
  },
});
