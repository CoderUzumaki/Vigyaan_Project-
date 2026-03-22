// ─────────────────────────────────────────────────────────────────────────────
// SOS Screen — 4-layer intent verification system
//
// Layer 1: 3-second physical hold on SOS button
// Layer 2: Gyroscope/accelerometer check → covert PIN or type selection
// Layer 3: Type selection (Medical / Fire / Police) + 5s countdown
// Layer 4: Covert PIN screen (if phone is stationary/face-down)
// + Active Emergency screen after SOS confirmed
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Vibration,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import Toast from 'react-native-toast-message';
import api from '../../lib/api';
import { colors, radii } from '../../constants/theme';
import type { SosType, IntentMethod, ActiveIncident } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HOLD_DURATION = 3000;
const COUNTDOWN_SECONDS = 5;

// ── SOS type config ─────────────────────────────────────────────────────────

const sosTypes: { key: SosType; label: string; icon: string; color: string }[] = [
  { key: 'medical', label: 'Medical', icon: 'medkit', color: '#3b82f6' },
  { key: 'fire', label: 'Fire', icon: 'flame', color: '#f97316' },
  { key: 'police', label: 'Police', icon: 'shield-checkmark', color: '#1e3a5f' },
];

// ── Main SOS Screen ─────────────────────────────────────────────────────────

type Phase = 'hold' | 'gyro_check' | 'type_select' | 'countdown' | 'covert_pin' | 'sending' | 'active';

export default function SOSScreen() {
  const [phase, setPhase] = useState<Phase>('hold');
  const [selectedType, setSelectedType] = useState<SosType | null>(null);
  const [countdownValue, setCountdownValue] = useState(COUNTDOWN_SECONDS);
  const [pinCode, setPinCode] = useState('');
  const [pinAttempts, setPinAttempts] = useState(0);
  const [pinError, setPinError] = useState(false);
  const [activeIncident, setActiveIncident] = useState<ActiveIncident | null>(null);

  // ── Layer 1: Hold Button ────────────────────────────────────────────────

  const holdProgress = useRef(new Animated.Value(0)).current;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const isHolding = useRef(false);

  const onPressIn = useCallback(() => {
    isHolding.current = true;
    holdProgress.setValue(0);

    holdAnimation.current = Animated.timing(holdProgress, {
      toValue: 1,
      duration: HOLD_DURATION,
      useNativeDriver: false,
    });

    holdAnimation.current.start(({ finished }) => {
      if (finished && isHolding.current) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        Vibration.vibrate(200);
        setPhase('gyro_check');
      }
    });
  }, [holdProgress]);

  const onPressOut = useCallback(() => {
    isHolding.current = false;
    if (holdAnimation.current) {
      holdAnimation.current.stop();
    }
    Animated.timing(holdProgress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [holdProgress]);

  // ── Layer 2: Gyroscope Check ────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'gyro_check') return;

    let gyroData = { x: 0, y: 0, z: 0 };
    let accelData = { x: 0, y: 0, z: 0 };
    let gyroSub: any = null;
    let accelSub: any = null;

    try {
      Gyroscope.setUpdateInterval(100);
      Accelerometer.setUpdateInterval(100);

      gyroSub = Gyroscope.addListener((data) => {
        gyroData = data;
      });
      accelSub = Accelerometer.addListener((data) => {
        accelData = data;
      });
    } catch (e) {
      console.warn('[SOS] Sensors not available:', e);
    }

    const timeout = setTimeout(() => {
      if (gyroSub) gyroSub.remove();
      if (accelSub) accelSub.remove();

      const isStationary =
        Math.abs(gyroData.x) < 0.1 &&
        Math.abs(gyroData.y) < 0.1 &&
        Math.abs(gyroData.z) < 0.1;
      const isFaceDown = accelData.z > 0.8;

      if (isStationary || isFaceDown) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setPhase('covert_pin');
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setPhase('type_select');
      }
    }, 500);

    return () => {
      clearTimeout(timeout);
      if (gyroSub) gyroSub.remove();
      if (accelSub) accelSub.remove();
    };
  }, [phase]);

  // ── Layer 3: Countdown ──────────────────────────────────────────────────

  const countdownAnim = useRef(new Animated.Value(1)).current;
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase !== 'countdown') return;

    setCountdownValue(COUNTDOWN_SECONDS);
    countdownAnim.setValue(1);

    Animated.timing(countdownAnim, {
      toValue: 0,
      duration: COUNTDOWN_SECONDS * 1000,
      useNativeDriver: false,
    }).start();

    let remaining = COUNTDOWN_SECONDS;
    countdownInterval.current = setInterval(() => {
      remaining--;
      setCountdownValue(remaining);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (remaining <= 0) {
        if (countdownInterval.current) clearInterval(countdownInterval.current);
        confirmSOS('countdown');
      }
    }, 1000);

    return () => {
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
  }, [phase]);

  // ── Layer 4: Covert PIN ─────────────────────────────────────────────────

  const pinShakeAnim = useRef(new Animated.Value(0)).current;

  function handlePinPress(digit: string) {
    if (pinCode.length >= 4) return;
    const newPin = pinCode + digit;
    setPinCode(newPin);
    setPinError(false);

    if (newPin.length === 4) {
      // Covert SOS defaults to police — PIN verified server-side via bcrypt
      setSelectedType('police');
      confirmSOS('pin', 0, newPin);
    }
  }

  function handlePinDelete() {
    setPinCode((prev) => prev.slice(0, -1));
    setPinError(false);
  }

  function triggerPinShake() {
    Animated.sequence([
      Animated.timing(pinShakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(pinShakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(pinShakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(pinShakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }

  // ── confirmSOS ──────────────────────────────────────────────────────────

  async function confirmSOS(method: IntentMethod, retryCount = 0, pin?: string) {
    setPhase('sending');
    const timestamp = new Date().toISOString();

    try {
      const payload: any = {
        sosType: selectedType || 'police',
        intentMethod: method === 'pin' ? 'pin' : 'countdown',
        clientTimestamp: timestamp,
      };
      // Include PIN for covert PIN method (server validates via bcrypt)
      if (method === 'pin' && pin) {
        payload.pin = pin;
      }

      const { data } = await api.post('/api/sos/confirm', payload);

      const incident: ActiveIncident = {
        incidentId: data.incidentId,
        sosType: selectedType || 'police',
        intentMethod: method,
        clientTimestamp: timestamp,
        responderEta: null,
        responderStatus: null,
        blockchainStatus: 'pending',
        fabricTxHash: null,
      };

      setActiveIncident(incident);
      setPhase('active');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Poll for ETA from nearest service location every 10s
      fetchETA(data.incidentId);
      const etaInterval = setInterval(() => fetchETA(data.incidentId), 10000);

      // Auto-mark blockchain as confirmed after backend processes it
      // (In production this would come via WebSocket, but polling is reliable)
      setTimeout(async () => {
        try {
          const { data: histData } = await api.get('/api/tourist/history');
          const match = histData.sos?.find((s: any) => s.id === data.incidentId);
          if (match?.fabricTxHash && match.fabricTxHash !== 'pending') {
            setActiveIncident((prev) =>
              prev
                ? { ...prev, blockchainStatus: 'confirmed', fabricTxHash: match.fabricTxHash }
                : prev,
            );
            Toast.show({ type: 'success', text1: 'Blockchain', text2: 'SOS recorded on-chain ✓' });
          }
        } catch { /* silent */ }
      }, 5000);

      // Store interval so it can be cleared on cancel
      (globalThis as any).__etaInterval = etaInterval;
    } catch (err: any) {
      if (err?.response?.status === 429) {
        Toast.show({ type: 'error', text1: 'SOS already active', text2: 'A distress signal is already being processed' });
        setPhase('hold');
      } else if (err?.response?.status === 400 && method === 'pin') {
        // PIN validation failed on server
        setPinError(true);
        setPinAttempts((prev) => prev + 1);
        triggerPinShake();
        setPinCode('');
        setPhase('covert_pin');
      } else if (retryCount < 1) {
        Toast.show({ type: 'info', text1: 'Sending failed', text2: 'Retrying in 3 seconds...' });
        setTimeout(() => confirmSOS(method, retryCount + 1, pin), 3000);
      } else {
        Toast.show({ type: 'error', text1: 'SOS Failed', text2: 'Could not send distress signal' });
        setPhase('hold');
      }
    }
  }

  // ── Fetch ETA from nearest service location ─────────────────────────────

  async function fetchETA(incidentId: string) {
    try {
      const { data } = await api.get(`/api/sos/eta?incidentId=${incidentId}`);
      if (data.etaSeconds) {
        setActiveIncident((prev) =>
          prev
            ? {
                ...prev,
                responderEta: data.etaSeconds,
                responderStatus: `${data.nearestService?.name ?? 'Nearest unit'} dispatched`,
              }
            : prev,
        );
      }
    } catch {
      // Silent fail — will retry on next interval
    }
  }

  // ── Cancel SOS ──────────────────────────────────────────────────────────

  async function cancelSOS() {
    try {
      // Clear ETA polling interval
      if ((globalThis as any).__etaInterval) {
        clearInterval((globalThis as any).__etaInterval);
        (globalThis as any).__etaInterval = null;
      }
      await api.post('/api/sos/cancel', { incidentId: activeIncident?.incidentId });
      Toast.show({ type: 'info', text1: 'SOS Cancelled', text2: 'Marked as false alarm' });
      resetAll();
    } catch {
      Toast.show({ type: 'error', text1: 'Cancel failed' });
    }
  }

  async function cancelCountdown() {
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    try {
      await api.post('/api/sos/cancel');
      Toast.show({ type: 'info', text1: 'SOS Cancelled' });
    } catch {
      // silent
    }
    resetAll();
  }

  function resetAll() {
    setPhase('hold');
    setSelectedType(null);
    setCountdownValue(COUNTDOWN_SECONDS);
    setPinCode('');
    setPinAttempts(0);
    setPinError(false);
    setActiveIncident(null);
    holdProgress.setValue(0);
    countdownAnim.setValue(1);
  }

  // ── RENDER ──────────────────────────────────────────────────────────────

  // Layer 1: Hold button
  if (phase === 'hold') {
    const ringColor = holdProgress.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: ['#ef444440', '#f97316', '#22c55e'],
    });

    const ringWidth = holdProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [4, 8],
    });

    const scale = holdProgress.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [1, 1.05, 1.1],
    });

    return (
      <View style={{ flex: 1, backgroundColor: colors.surface.lowest, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.red, marginBottom: 8 }}>
          Emergency SOS
        </Text>
        <Text style={{ fontSize: 13, color: colors.text.secondary, marginBottom: 48, textAlign: 'center' }}>
          Press and hold the button for 3 seconds
        </Text>

        <Animated.View
          style={{
            width: 190,
            height: 190,
            borderRadius: 95,
            borderWidth: ringWidth as any,
            borderColor: ringColor as any,
            justifyContent: 'center',
            alignItems: 'center',
            transform: [{ scale: scale as any }],
          }}
        >
          <TouchableOpacity
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            activeOpacity={0.9}
            style={{
              width: 180,
              height: 180,
              borderRadius: 90,
              backgroundColor: colors.red,
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: '#ef4444',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 30,
              elevation: 10,
            }}
          >
            <Ionicons name="alert-circle" size={48} color="#fff" />
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 4 }}>SOS</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Progress hint */}
        <Animated.Text
          style={{
            marginTop: 32,
            fontSize: 13,
            color: holdProgress.interpolate({
              inputRange: [0, 0.3, 1],
              outputRange: ['#475569', '#f59e0b', '#22c55e'],
            }) as any,
            fontWeight: '500',
          }}
        >
          Hold for 3 seconds to activate
        </Animated.Text>

        <Text style={{ fontSize: 11, color: '#334155', marginTop: 16, textAlign: 'center' }}>
          Your GPS location will be sent to emergency services{'\n'}and recorded on the blockchain
        </Text>
      </View>
    );
  }

  // Gyro check — loading spinner
  if (phase === 'gyro_check') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface.lowest, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#14b8a6" />
        <Text style={{ fontSize: 14, color: colors.text.secondary, marginTop: 16 }}>Verifying intent...</Text>
      </View>
    );
  }

  // Layer 3: Type selection
  if (phase === 'type_select') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface.lowest, justifyContent: 'center', padding: 24 }}>
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Ionicons name="alert-circle" size={40} color="#ef4444" />
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.red, marginTop: 8 }}>
            Select Emergency Type
          </Text>
          <Text style={{ fontSize: 13, color: colors.text.secondary, marginTop: 6 }}>
            Choose the type of help you need
          </Text>
        </View>

        {/* Type buttons */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 }}>
          {sosTypes.map((type) => {
            const isSelected = selectedType === type.key;
            return (
              <TouchableOpacity
                key={type.key}
                onPress={() => {
                  setSelectedType(type.key);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.7}
                style={{
                  width: (SCREEN_WIDTH - 72) / 3,
                  backgroundColor: isSelected ? type.color + '25' : '#0f1424',
                  borderRadius: 16,
                  padding: 20,
                  alignItems: 'center',
                  borderWidth: 2,
                  borderColor: isSelected ? type.color : '#1e2640',
                }}
              >
                <Ionicons
                  name={type.icon as any}
                  size={36}
                  color={isSelected ? type.color : '#475569'}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: isSelected ? type.color : '#94a3b8',
                    marginTop: 10,
                  }}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Confirm button */}
        <TouchableOpacity
          onPress={() => {
            if (selectedType) {
              setPhase('countdown');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
          }}
          disabled={!selectedType}
          activeOpacity={0.7}
          style={{
            backgroundColor: selectedType ? '#ef4444' : '#ef444430',
            borderRadius: 14,
            padding: 18,
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: selectedType ? '#fff' : '#ffffff50' }}>
            {selectedType ? `Confirm ${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} SOS` : 'Select a type'}
          </Text>
        </TouchableOpacity>

        {/* Back button */}
        <TouchableOpacity
          onPress={resetAll}
          style={{ padding: 12, alignItems: 'center' }}
        >
          <Text style={{ fontSize: 13, color: colors.text.secondary }}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Countdown overlay
  if (phase === 'countdown') {
    const typeLabel = selectedType
      ? selectedType.charAt(0).toUpperCase() + selectedType.slice(1)
      : 'Emergency';

    const ringSize = 140;

    return (
      <View style={{
        flex: 1,
        backgroundColor: '#0a0e1aee',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
      }}>
        <Text style={{ fontSize: 14, color: '#f59e0b', fontWeight: '600', marginBottom: 32, textTransform: 'uppercase', letterSpacing: 2 }}>
          {typeLabel} SOS in {countdownValue} seconds...
        </Text>

        {/* Countdown circle */}
        <View style={{
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
          borderWidth: 4,
          borderColor: '#ef444440',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 40,
        }}>
          <Animated.View style={{
            position: 'absolute',
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderWidth: 4,
            borderColor: '#ef4444',
            opacity: countdownAnim,
          }} />
          <Text style={{ fontSize: 56, fontWeight: '800', color: colors.red }}>{countdownValue}</Text>
        </View>

        <Text style={{ fontSize: 13, color: colors.text.secondary, marginBottom: 40 }}>
          Your location will be shared with responders
        </Text>

        {/* Cancel button */}
        <TouchableOpacity
          onPress={cancelCountdown}
          activeOpacity={0.7}
          style={{
            backgroundColor: '#ffffff15',
            borderRadius: 14,
            paddingVertical: 16,
            paddingHorizontal: 48,
            borderWidth: 1,
            borderColor: '#ffffff30',
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>CANCEL</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Layer 4: Covert PIN screen (no emergency language)
  if (phase === 'covert_pin') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface.base, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Ionicons name="lock-closed" size={32} color="#94a3b8" style={{ marginBottom: 12 }} />
        <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text.primary, marginBottom: 32 }}>
          Enter PIN
        </Text>

        {/* PIN dots */}
        <Animated.View style={{
          flexDirection: 'row',
          gap: 16,
          marginBottom: 8,
          transform: [{ translateX: pinShakeAnim }],
        }}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: i < pinCode.length ? '#e1e4ea' : 'transparent',
                borderWidth: 2,
                borderColor: pinError ? '#ef4444' : '#475569',
              }}
            />
          ))}
        </Animated.View>

        {pinError && (
          <Text style={{ fontSize: 12, color: colors.red, marginBottom: 16 }}>Incorrect PIN</Text>
        )}
        {!pinError && <View style={{ height: 28 }} />}

        {pinAttempts >= 2 && (
          <TouchableOpacity onPress={() => { resetAll(); setPhase('hold'); }} style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, color: colors.text.secondary }}>Use hold instead</Text>
          </TouchableOpacity>
        )}

        {/* Number pad */}
        <View style={{ width: 280, gap: 12 }}>
          {[[1, 2, 3], [4, 5, 6], [7, 8, 9], [null, 0, 'del']].map((row, ri) => (
            <View key={ri} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {row.map((key, ki) => {
                if (key === null) return <View key={ki} style={{ width: 72, height: 56 }} />;

                const isDelete = key === 'del';
                return (
                  <TouchableOpacity
                    key={ki}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (isDelete) handlePinDelete();
                      else handlePinPress(String(key));
                    }}
                    activeOpacity={0.6}
                    style={{
                      width: 72,
                      height: 56,
                      borderRadius: 12,
                      backgroundColor: isDelete ? 'transparent' : '#1a2035',
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: isDelete ? 0 : 1,
                      borderColor: colors.border.subtle,
                    }}
                  >
                    {isDelete ? (
                      <Ionicons name="backspace-outline" size={22} color="#94a3b8" />
                    ) : (
                      <Text style={{ fontSize: 22, fontWeight: '500', color: colors.text.primary }}>{key}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Sending state
  if (phase === 'sending') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface.lowest, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#ef4444" />
        <Text style={{ fontSize: 16, color: colors.red, marginTop: 16, fontWeight: '600' }}>
          Sending SOS...
        </Text>
        <Text style={{ fontSize: 12, color: colors.text.muted, marginTop: 8 }}>
          Contacting emergency services
        </Text>
      </View>
    );
  }

  // Active Emergency screen
  if (phase === 'active' && activeIncident) {
    const typeConf = sosTypes.find((t) => t.key === activeIncident.sosType);
    const etaMin = activeIncident.responderEta
      ? Math.ceil(activeIncident.responderEta / 60)
      : null;

    return (
      <View style={{ flex: 1, backgroundColor: '#fff5f5', padding: 24 }}>
        {/* Header */}
        <View style={{ alignItems: 'center', marginTop: 60, marginBottom: 32 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: colors.red + '30',
            justifyContent: 'center', alignItems: 'center', marginBottom: 16,
          }}>
            <Ionicons name="alert-circle" size={48} color="#ef4444" />
          </View>
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.red, letterSpacing: 1 }}>
            SOS CONFIRMED
          </Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center', marginTop: 12,
            backgroundColor: (typeConf?.color ?? '#64748b') + '30',
            borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
          }}>
            <Ionicons name={(typeConf?.icon ?? 'alert') as any} size={16} color={typeConf?.color ?? '#fff'} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: typeConf?.color ?? '#fff', marginLeft: 6 }}>
              {typeConf?.label ?? 'Emergency'}
            </Text>
          </View>
          <Text style={{ fontSize: 14, color: colors.red + '80', marginTop: 12 }}>
            Responders have been notified
          </Text>
        </View>

        {/* Responder ETA */}
        <View style={{
          backgroundColor: colors.surface.base,
          borderRadius: 14,
          padding: 18,
          marginBottom: 14,
          borderWidth: 1,
          borderColor: colors.border.medium,
        }}>
          <Text style={{ fontSize: 11, color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Responder Status
          </Text>
          {etaMin ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="timer" size={20} color="#f59e0b" />
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#f59e0b', marginLeft: 8 }}>
                ETA: ~{etaMin} min
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#14b8a6" />
              <Text style={{ fontSize: 14, color: colors.text.muted, marginLeft: 8 }}>
                Locating nearest responder...
              </Text>
            </View>
          )}
          {activeIncident.responderStatus && (
            <Text style={{ fontSize: 12, color: colors.text.secondary, marginTop: 6, textTransform: 'capitalize' }}>
              Status: {activeIncident.responderStatus}
            </Text>
          )}
        </View>

        {/* Blockchain status */}
        <View style={{
          backgroundColor: colors.surface.base,
          borderRadius: 14,
          padding: 18,
          marginBottom: 14,
          borderWidth: 1,
          borderColor: colors.border.medium,
        }}>
          <Text style={{ fontSize: 11, color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Blockchain Record
          </Text>
          {activeIncident.blockchainStatus === 'pending' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#f59e0b" />
              <Text style={{ fontSize: 14, color: '#f59e0b', marginLeft: 8 }}>
                Recording to blockchain...
              </Text>
            </View>
          ) : (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                <Text style={{ fontSize: 14, color: '#22c55e', fontWeight: '600', marginLeft: 8 }}>
                  Confirmed ✓
                </Text>
              </View>
              {activeIncident.fabricTxHash && (
                <Text style={{ fontSize: 10, color: colors.text.muted, marginTop: 4, fontFamily: 'monospace' }}>
                  TX: {activeIncident.fabricTxHash}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Action buttons */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={{
            backgroundColor: '#14b8a620',
            borderRadius: 12,
            padding: 16,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#14b8a640',
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#14b8a6' }}>
            View evacuation route
          </Text>
        </TouchableOpacity>

        {/* Cancel SOS */}
        <TouchableOpacity
          onPress={cancelSOS}
          activeOpacity={0.7}
          style={{
            padding: 16,
            alignItems: 'center',
            marginTop: 8,
          }}
        >
          <Text style={{ fontSize: 13, color: colors.text.secondary }}>
            Cancel — this was a mistake
          </Text>
        </TouchableOpacity>

        {/* Incident ID */}
        <Text style={{ fontSize: 10, color: '#334155', textAlign: 'center', marginTop: 16, fontFamily: 'monospace' }}>
          Incident: {activeIncident.incidentId}
        </Text>
      </View>
    );
  }

  // Fallback
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface.lowest, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#14b8a6" />
    </View>
  );
}
