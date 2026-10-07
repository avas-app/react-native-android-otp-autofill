import { useEffect, useState } from 'react'
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  getAppHash,
  isSupported,
  useOtp,
} from '@avasapp/react-native-otp-autofill'

export default function App() {
  const [hash, setHash] = useState<string | null>(null)
  const [hashError, setHashError] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])

  useEffect(() => {
    getAppHash().then(setHash, (e: Error) => setHashError(e.message))
  }, [])

  const { status, otp, message, error, start, stop } = useOtp({
    autoStart: false,
    onOtp: (code) =>
      setLog((l) => [`${new Date().toLocaleTimeString()} onOtp ${code}`, ...l]),
  })

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>OTP autofill</Text>
        <Row label="Supported" value={String(isSupported)} />
        <Row label="App hash" value={hash ?? hashError ?? '…'} selectable />

        <View style={styles.buttons}>
          <Button title="Start" onPress={start} />
          <Button title="Stop" onPress={stop} />
        </View>

        <Row label="Status" value={status} testID="status" />
        <Row label="OTP" value={otp ?? '—'} testID="otp" />
        <Row label="Message" value={message ?? '—'} />
        <Row
          label="Error"
          value={error ? `${error.code}: ${error.message}` : '—'}
          testID="error"
        />

        <Text style={styles.label}>Send this SMS to the device</Text>
        <Text style={styles.sms} selectable>
          {`Your code is 482913\n${hash ?? '<hash>'}`}
        </Text>

        <Text style={styles.label}>Log</Text>
        {log.map((line) => (
          <Text key={line} style={styles.mono}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </View>
  )
}

function Row(props: {
  label: string
  value: string
  selectable?: boolean
  testID?: string
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{props.label}</Text>
      <Text
        style={styles.mono}
        selectable={props.selectable}
        testID={props.testID}
      >
        {props.value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '600', color: '#111' },
  row: { gap: 2 },
  label: { fontSize: 12, color: '#666', textTransform: 'uppercase' },
  mono: { fontFamily: 'monospace', fontSize: 15, color: '#111' },
  buttons: { flexDirection: 'row', gap: 12 },
  sms: {
    fontFamily: 'monospace',
    padding: 8,
    backgroundColor: '#f2f2f2',
    color: '#111',
  },
})
