import React, { useState } from 'react';
import { SafeAreaView, View, Text, Button, ScrollView, TouchableOpacity } from 'react-native';

function ScreenContainer({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: '#f8fafc' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 8 }}>{title}</Text>
        <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8 }}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  const [route, setRoute] = useState<'home'|'auth'|'create'|'rooms'|'dashboard'|'map'|'room'|'settings'>('home');

  return (
    <>
      {route === 'home' && (
        <ScreenContainer title="Welcome">
          <Text style={{ marginBottom: 12 }}>Secure home knowledge for owners and renters.</Text>
          <Button title="Create Property" onPress={() => setRoute('create')} />
          <View style={{ height: 8 }} />
          <Button title="Sign In" onPress={() => setRoute('auth')} />
        </ScreenContainer>
      )}

      {route === 'auth' && (
        <ScreenContainer title="Auth Placeholder">
          <Text>Auth is not wired yet.</Text>
          <Button title="Back" onPress={() => setRoute('home')} />
        </ScreenContainer>
      )}

      {route === 'create' && (
        <ScreenContainer title="Create Property">
          <Text>Property setup flow (local mock)</Text>
          <Button title="Next: Add Rooms" onPress={() => setRoute('rooms')} />
          <Button title="Back" onPress={() => setRoute('home')} />
        </ScreenContainer>
      )}

      {route === 'rooms' && (
        <ScreenContainer title="Add Rooms">
          <Text>Add rooms screen (local mock)</Text>
          <Button title="Go to Dashboard" onPress={() => setRoute('dashboard')} />
        </ScreenContainer>
      )}

      {route === 'dashboard' && (
        <ScreenContainer title="Property Dashboard">
          <Button title="Home Map" onPress={() => setRoute('map')} />
        </ScreenContainer>
      )}

      {route === 'map' && (
        <ScreenContainer title="Home Map">
          <Text>Floor and room list (mock)</Text>
          <TouchableOpacity onPress={() => setRoute('room')} style={{ marginTop: 8 }}>
            <Text style={{ color: '#0b5' }}>Open Room</Text>
          </TouchableOpacity>
        </ScreenContainer>
      )}

      {route === 'room' && (
        <ScreenContainer title="Room Detail">
          <Text>Room detail (mock)</Text>
        </ScreenContainer>
      )}

      {route === 'settings' && (
        <ScreenContainer title="Settings">
          <Text>Settings placeholder</Text>
        </ScreenContainer>
      )}
    </>
  );
}
