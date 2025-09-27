import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { AuthScreen } from '../screens/AuthScreen';
import { MapScreen } from '../screens/MapScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { URLImportScreen } from '../screens/URLImportScreen';
import { SupabaseDebugScreen } from '../screens/SupabaseDebugScreen';

const Tab = createBottomTabNavigator();

export const AppNavigator: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return null; // You could add a loading screen here
  }

  if (!user) {
    return <AuthScreen isSignUp={true} />;
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            if (route.name === 'Map') {
              iconName = focused ? 'map' : 'map-outline';
            } else if (route.name === 'Import') {
              iconName = focused ? 'add-circle' : 'add-circle-outline';
            } else if (route.name === 'Debug') {
              iconName = focused ? 'bug' : 'bug-outline';
            } else if (route.name === 'Profile') {
              iconName = focused ? 'person' : 'person-outline';
            } else {
              iconName = 'help-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: 'gray',
          headerShown: false,
        })}
      >
        <Tab.Screen
          name="Map"
          component={MapScreen}
          options={{
            title: 'Map',
          }}
        />
        <Tab.Screen
          name="Import"
          component={URLImportScreen}
          options={{
            title: 'Import',
          }}
        />
        <Tab.Screen
          name="Debug"
          component={SupabaseDebugScreen}
          options={{
            title: 'Debug',
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            title: 'My Library',
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};
