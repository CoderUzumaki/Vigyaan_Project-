// ─────────────────────────────────────────────────────────────────────────────
// KYC Submission Flow — Passport + Selfie capture → submit for verification
// TODO: Connect to real POST /api/kyc/submit
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import api from '../../lib/api';

type KYCStep = 'instructions' | 'passport_capture' | 'selfie_capture' | 'review' | 'submitted';

export default function KYCScreen() {
  const [step, setStep] = useState<KYCStep>('instructions');
  const [passportUri, setPassportUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  // ── Camera capture ──────────────────────────────────────────────────────

  async function takePicture(type: 'passport' | 'selfie') {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo) return;

      if (type === 'passport') {
        setPassportUri(photo.uri);
      } else {
        setSelfieUri(photo.uri);
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Capture failed', text2: 'Please try again' });
    }
  }

  // ── Gallery fallback ────────────────────────────────────────────────────

  async function pickFromGallery(type: 'passport' | 'selfie') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Gallery access required' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      if (type === 'passport') {
        setPassportUri(result.assets[0].uri);
      } else {
        setSelfieUri(result.assets[0].uri);
      }
    }
  }

  // ── Submit KYC ──────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!passportUri || !selfieUri) {
      Toast.show({ type: 'error', text1: 'Photos required', text2: 'Both passport and selfie needed' });
      return;
    }

    setSubmitting(true);
    try {
      // TODO: Replace mock with real multipart upload
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

      const { data } = await api.post('/api/kyc/submit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSubmissionId(data.submissionId);
      setStep('submitted');
      Toast.show({ type: 'success', text1: 'KYC Submitted', text2: 'Pending admin review' });
    } catch {
      Toast.show({ type: 'error', text1: 'Submission failed', text2: 'Please try again' });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step 1: Instructions ────────────────────────────────────────────────

  if (step === 'instructions') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0e1a' }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 20 }}>
          {/* Back button */}
          <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 20 }}>
            <Ionicons name="arrow-back" size={24} color="#64748b" />
          </TouchableOpacity>

          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <View style={{
              width: 72, height: 72, borderRadius: 36,
              backgroundColor: '#14b8a620',
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <Ionicons name="shield-checkmark" size={36} color="#14b8a6" />
            </View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#e1e4ea' }}>
              Identity Verification
            </Text>
            <Text style={{ fontSize: 14, color: '#64748b', marginTop: 8, textAlign: 'center' }}>
              Complete KYC to unlock all safety features
            </Text>
          </View>

          {/* Steps */}
          {[
            { icon: 'card', title: 'Passport / ID Photo', desc: 'Take a clear photo of your government-issued ID' },
            { icon: 'camera', title: 'Selfie', desc: 'Take a selfie to match against your document' },
            { icon: 'cloud-upload', title: 'Submit', desc: 'Review and send for admin verification' },
          ].map((item, i) => (
            <View key={i} style={{
              flexDirection: 'row',
              backgroundColor: '#0f1424',
              borderRadius: 12,
              padding: 16,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: '#1e2640',
              alignItems: 'center',
            }}>
              <View style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: '#14b8a615',
                alignItems: 'center', justifyContent: 'center', marginRight: 14,
              }}>
                <Ionicons name={item.icon as any} size={18} color="#14b8a6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#e1e4ea' }}>{item.title}</Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{item.desc}</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#475569' }}>{i + 1}</Text>
            </View>
          ))}

          <Text style={{ fontSize: 12, color: '#475569', marginTop: 16, marginBottom: 6 }}>
            Accepted documents:
          </Text>
          {['Passport', 'National ID Card', 'Driving License'].map((doc) => (
            <Text key={doc} style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>• {doc}</Text>
          ))}

          <TouchableOpacity
            onPress={async () => {
              if (!cameraPermission?.granted) {
                const res = await requestCameraPermission();
                if (!res.granted) {
                  Toast.show({ type: 'error', text1: 'Camera permission required' });
                  return;
                }
              }
              setStep('passport_capture');
            }}
            style={{
              backgroundColor: '#14b8a6',
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              marginTop: 24,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Start Verification</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Step 2: Passport capture ────────────────────────────────────────────

  if (step === 'passport_capture') {
    if (passportUri) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0e1a' }}>
          <View style={{ flex: 1, padding: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#e1e4ea', marginBottom: 12 }}>
              Document Photo
            </Text>
            <Image source={{ uri: passportUri }} style={{ flex: 1, borderRadius: 12, marginBottom: 16 }} resizeMode="contain" />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => { setStep('selfie_capture'); }}
                style={{
                  flex: 1, backgroundColor: '#14b8a6', borderRadius: 10,
                  padding: 14, alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Use this photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPassportUri(null)}
                style={{
                  flex: 1, backgroundColor: '#1e2640', borderRadius: 10,
                  padding: 14, alignItems: 'center',
                }}
              >
                <Text style={{ color: '#94a3b8', fontWeight: '600' }}>Retake</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
          {/* Document frame overlay */}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{
              width: '85%',
              aspectRatio: 1.586, // ID card aspect ratio
              borderWidth: 2,
              borderColor: '#fff',
              borderRadius: 12,
              borderStyle: 'dashed',
            }} />
            <Text style={{ color: '#fff', fontSize: 14, marginTop: 16, fontWeight: '500' }}>
              Align your document within the frame
            </Text>
          </View>

          {/* Controls */}
          <View style={{ paddingBottom: 40, paddingHorizontal: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => pickFromGallery('passport')}>
                <Ionicons name="images" size={28} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => takePicture('passport')}
                style={{
                  width: 72, height: 72, borderRadius: 36,
                  borderWidth: 4, borderColor: '#fff',
                  backgroundColor: '#ffffff30',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' }} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStep('instructions')}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  // ── Step 3: Selfie capture ──────────────────────────────────────────────

  if (step === 'selfie_capture') {
    if (selfieUri) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0e1a' }}>
          <View style={{ flex: 1, padding: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#e1e4ea', marginBottom: 12 }}>
              Selfie Photo
            </Text>
            <Image source={{ uri: selfieUri }} style={{ flex: 1, borderRadius: 12, marginBottom: 16 }} resizeMode="contain" />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setStep('review')}
                style={{
                  flex: 1, backgroundColor: '#14b8a6', borderRadius: 10,
                  padding: 14, alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Use this photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSelfieUri(null)}
                style={{
                  flex: 1, backgroundColor: '#1e2640', borderRadius: 10,
                  padding: 14, alignItems: 'center',
                }}
              >
                <Text style={{ color: '#94a3b8', fontWeight: '600' }}>Retake</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front">
          {/* Face oval guide */}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{
              width: 220,
              height: 300,
              borderWidth: 2,
              borderColor: '#fff',
              borderRadius: 110,
              borderStyle: 'dashed',
            }} />
            <Text style={{ color: '#fff', fontSize: 14, marginTop: 16, fontWeight: '500' }}>
              Position your face in the oval
            </Text>
          </View>

          {/* Controls */}
          <View style={{ paddingBottom: 40, paddingHorizontal: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => pickFromGallery('selfie')}>
                <Ionicons name="images" size={28} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => takePicture('selfie')}
                style={{
                  width: 72, height: 72, borderRadius: 36,
                  borderWidth: 4, borderColor: '#fff',
                  backgroundColor: '#ffffff30',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' }} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setSelfieUri(null); setStep('passport_capture'); }}>
                <Ionicons name="arrow-back" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  // ── Step 4: Review & submit ─────────────────────────────────────────────

  if (step === 'review') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0e1a' }}>
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#e1e4ea', marginBottom: 20 }}>
            Review & Submit
          </Text>

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            {/* Passport preview */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Document</Text>
              {passportUri && (
                <Image
                  source={{ uri: passportUri }}
                  style={{ width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor: '#0f1424' }}
                  resizeMode="cover"
                />
              )}
              <TouchableOpacity
                onPress={() => { setPassportUri(null); setStep('passport_capture'); }}
                style={{ marginTop: 6 }}
              >
                <Text style={{ fontSize: 11, color: '#14b8a6', textAlign: 'center' }}>Retake</Text>
              </TouchableOpacity>
            </View>

            {/* Selfie preview */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Selfie</Text>
              {selfieUri && (
                <Image
                  source={{ uri: selfieUri }}
                  style={{ width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor: '#0f1424' }}
                  resizeMode="cover"
                />
              )}
              <TouchableOpacity
                onPress={() => { setSelfieUri(null); setStep('selfie_capture'); }}
                style={{ marginTop: 6 }}
              >
                <Text style={{ fontSize: 11, color: '#14b8a6', textAlign: 'center' }}>Retake</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={{
              backgroundColor: '#14b8a6',
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Submit for Verification</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setStep('instructions')}
            style={{ padding: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#64748b', fontSize: 13 }}>← Start over</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Submitted confirmation ──────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0e1a' }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{
          width: 80, height: 80, borderRadius: 40,
          backgroundColor: '#22c55e20',
          alignItems: 'center', justifyContent: 'center', marginBottom: 20,
        }}>
          <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#22c55e', marginBottom: 8 }}>
          KYC Submitted!
        </Text>
        <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 8 }}>
          Your documents are pending admin review.{'\n'}You will be notified once verified.
        </Text>
        {submissionId && (
          <Text style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', marginBottom: 24 }}>
            Submission: {submissionId}
          </Text>
        )}
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            backgroundColor: '#14b8a620', borderRadius: 10,
            paddingVertical: 12, paddingHorizontal: 32,
            borderWidth: 1, borderColor: '#14b8a640',
          }}
        >
          <Text style={{ color: '#14b8a6', fontWeight: '600' }}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
