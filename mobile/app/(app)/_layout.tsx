import { Tabs } from 'expo-router';
import { View, Text, Platform } from 'react-native';
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
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          height: Platform.OS === 'ios' ? 88 : 80,
          paddingBottom: Platform.OS === 'ios' ? 24 : 16,
          paddingTop: 8,
        },
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#1a73e8', // Google Blue active color
        tabBarInactiveTintColor: '#5f6368', // Google Gray inactive color
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
              {kycPending && (
                <View style={{
                  position: 'absolute',
                  top: -2,
                  right: -4,
                  backgroundColor: '#ea4335', // Google Red
                  borderRadius: 6,
                  width: 12,
                  height: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: '#fff',
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
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'location' : 'location-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sos"
        options={{
          title: 'Emergency',
          tabBarIcon: ({ focused }) => (
            <Ionicons 
              name={focused ? 'warning' : 'warning-outline'} 
              size={24} 
              color={focused ? '#ea4335' : '#5f6368'} 
            />
          ),
          tabBarActiveTintColor: '#ea4335', // Google Red when active
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'time' : 'time-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={24} color={color} />
          ),
        }}
      />
      {/* Hide KYC from the bottom tab bar directly */}
      <Tabs.Screen
        name="kyc"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
