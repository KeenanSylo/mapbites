import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';

export const SupabaseDebugScreen: React.FC = () => {
  const { user } = useAuth();
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [testResult, setTestResult] = useState<string>('');

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      setSessionInfo({
        session: session,
        error: error,
        userFromSession: session?.user,
        userFromHook: user,
      });
    } catch (error) {
      setSessionInfo({ error: error });
    }
  };

  const testDatabaseConnection = async () => {
    try {
      // Test a simple query that doesn't require RLS
      const { data, error } = await supabase
        .from('restaurants')
        .select('count')
        .limit(1);
      
      if (error) {
        setTestResult(`Database Error: ${error.message}`);
      } else {
        setTestResult('Database connection successful');
      }
    } catch (error: any) {
      setTestResult(`Connection Error: ${error.message}`);
    }
  };

  const testRLSInsert = async () => {
    if (!user) {
      setTestResult('No user logged in');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('restaurants')
        .insert({
          name: 'Test Restaurant',
          address: 'Test Address',
          latitude: 0,
          longitude: 0,
          user_id: user.id,
        } as any)
        .select()
        .single();

      if (error) {
        setTestResult(`RLS Insert Error: ${error.message}`);
      } else {
        setTestResult(`RLS Insert Success: ${data.name}`);
        // Clean up test data
        await supabase.from('restaurants').delete().eq('id', data.id);
      }
    } catch (error: any) {
      setTestResult(`RLS Insert Exception: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Supabase Debug</Text>
      
      <TouchableOpacity style={styles.button} onPress={checkSession}>
        <Text style={styles.buttonText}>Check Session</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={testDatabaseConnection}>
        <Text style={styles.buttonText}>Test DB Connection</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={testRLSInsert}>
        <Text style={styles.buttonText}>Test RLS Insert</Text>
      </TouchableOpacity>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Session Info:</Text>
        <Text style={styles.infoText}>{JSON.stringify(sessionInfo, null, 2)}</Text>
      </View>

      <View style={styles.resultContainer}>
        <Text style={styles.resultTitle}>Test Result:</Text>
        <Text style={styles.resultText}>{testResult}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  resultContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  resultText: {
    fontSize: 14,
    color: '#333',
  },
});
