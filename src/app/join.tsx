import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/hooks/useTheme';
import { toUserMessage } from '@/lib/errors';
import { extractJoinCode, normalizeJoinCode, sanitizeJoinCodeInput } from '@/lib/joinCode';
import { ROLE_LABELS } from '@/lib/permissions';
import { joinRoom, previewRoom, type RoomPreview } from '@/services/rooms/roomService';

export default function JoinRoomScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ code?: string }>();
  const [permission, requestPermission] = useCameraPermissions();

  const [codeInput, setCodeInput] = useState(sanitizeJoinCodeInput(params.code ?? ''));
  const [scanning, setScanning] = useState(false);
  const [looking, setLooking] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ code: string; room: RoomPreview } | null>(null);
  // The camera fires continuously while a QR code is in view; only act on the first.
  const scanHandled = useRef(false);

  const lookUp = useCallback(async (rawCode: string) => {
    const code = normalizeJoinCode(rawCode);
    if (!code) {
      setError('Enter the 6-character code from your invitation.');
      return;
    }
    setLooking(true);
    setError(null);
    try {
      setPreview({ code, room: await previewRoom(code) });
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setLooking(false);
    }
  }, []);

  // Opened from a babycare://join?code=... link: go straight to the confirmation.
  const linkedCode = params.code;
  useEffect(() => {
    if (linkedCode) void lookUp(linkedCode);
  }, [linkedCode, lookUp]);

  const startScanning = async () => {
    setError(null);
    const granted = permission?.granted || (await requestPermission()).granted;
    if (!granted) {
      setError('Camera access is off. You can type the code instead.');
      return;
    }
    scanHandled.current = false;
    setScanning(true);
  };

  const onScanned = (data: string) => {
    if (scanHandled.current) return;
    const code = extractJoinCode(data);
    if (!code) {
      setError('That QR code isn’t a BabyCare invitation.');
      return;
    }
    scanHandled.current = true;
    setScanning(false);
    setCodeInput(code);
    void lookUp(code);
  };

  const confirmJoin = async () => {
    if (!preview) return;
    setJoining(true);
    setError(null);
    try {
      await joinRoom(preview.code);
      router.replace('/');
    } catch (e) {
      setError(toUserMessage(e));
      setJoining(false);
    }
  };

  const cancelPreview = () => {
    setPreview(null);
    setError(null);
  };

  if (preview) {
    const { room } = preview;
    return (
      <Screen topInset={false}>
        <Stack.Screen options={{ title: 'Join family room' }} />
        {room.alreadyMember ? (
          <Card>
            <Text variant="heading">You’re already in {room.roomName}</Text>
            <Text muted>There’s nothing more to do.</Text>
          </Card>
        ) : (
          <Card>
            <Text variant="heading">Join {room.roomName}?</Text>
            {room.babyNames.length > 0 ? (
              <Text>
                <Text muted>{room.babyNames.length > 1 ? 'Babies: ' : 'Baby: '}</Text>
                {room.babyNames.join(', ')}
              </Text>
            ) : null}
            {room.ownerName ? (
              <Text>
                <Text muted>Created by: </Text>
                {room.ownerName}
              </Text>
            ) : null}
            <Text>
              <Text muted>You’ll join as: </Text>
              {ROLE_LABELS[room.role]}
            </Text>
          </Card>
        )}

        {error ? (
          <Text style={{ color: colors.danger }} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        {room.alreadyMember ? (
          <Button label="Back to home" onPress={() => router.replace('/')} />
        ) : (
          <>
            <Button label="Join room" onPress={confirmJoin} loading={joining} />
            <Button label="Cancel" variant="secondary" onPress={cancelPreview} disabled={joining} />
          </>
        )}
      </Screen>
    );
  }

  return (
    <Screen topInset={false}>
      <Stack.Screen options={{ title: 'Join family room' }} />
      <View style={{ gap: 4 }}>
        <Text variant="title">Join a family room</Text>
        <Text muted>Scan the QR code, or enter the 6-character code you were given.</Text>
      </View>

      {scanning ? (
        <View style={{ gap: 12 }}>
          <View style={{ height: 320, borderRadius: 20, overflow: 'hidden' }}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => onScanned(data)}
              accessibilityLabel="Camera for scanning an invitation QR code"
            />
          </View>
          <Button label="Stop scanning" variant="secondary" onPress={() => setScanning(false)} />
        </View>
      ) : (
        <Button label="Scan QR code" onPress={startScanning} disabled={looking} />
      )}

      <TextField
        label="Invitation code"
        value={codeInput}
        onChangeText={(text) => setCodeInput(sanitizeJoinCodeInput(text))}
        placeholder="K7M4P2"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        returnKeyType="go"
        onSubmitEditing={() => void lookUp(codeInput)}
        style={{ letterSpacing: 4, fontSize: 22, textAlign: 'center' }}
      />

      {error ? (
        <Text style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Button
        label="Find room"
        variant={scanning ? 'secondary' : 'primary'}
        onPress={() => void lookUp(codeInput)}
        loading={looking}
        disabled={codeInput.length < 6}
      />
    </Screen>
  );
}
