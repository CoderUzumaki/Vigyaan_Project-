// ─────────────────────────────────────────────────────────────────────────────
// Bottom Tab Navigator — Home, Map, SOS (centre), History, Profile
// ─────────────────────────────────────────────────────────────────────────────

import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../_layout';

export default function AppLayout() {
  const { user } = useAuth();
  const kycPending = user?.kycStatus === 'pending';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0f1424',
          borderTopColor: '#1e2640',
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#14b8a6',
        tabBarInactiveTintColor: '#64748b',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="home" size={size} color={color} />
              {kycPending && (
                <View style={{
                  position: 'absolute',
                  top: -2,
                  right: -6,
                  backgroundColor: '#f59e0b',
                  borderRadius: 6,
                  width: 12,
                  height: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Text style={{ color: '#fff', fontSize: 7, fontWeight: '800' }}>!</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sos"
        options={{
          title: 'SOS',
          tabBarIcon: ({ focused }) => (
            <View style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: focused ? '#dc2626' : '#ef4444',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              shadowColor: '#ef4444',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 8,
              elevation: 8,
            }}>
              <Ionicons name="alert-circle" size={28} color="#fff" />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
