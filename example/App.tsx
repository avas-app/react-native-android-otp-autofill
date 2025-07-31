import * as Clipboard from 'expo-clipboard'

import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useCallback, useState } from 'react'
import { useGetHash, useOtpListener } from '../src'

import { StatusBar } from 'expo-status-bar'

type StatusMessage = {
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  timestamp: number
}

export default function App() {
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([])

  // ! Ensure that the callbacks are not recreated on every render
  const onSuccessHash = useCallback((hash: string) => {
    addStatusMessage('success', `App hash loaded: ${hash.substring(0, 8)}...`)
  }, [])
  const onErrorHash = useCallback((error: Error) => {
    addStatusMessage('error', `Failed to load app hash: ${error.message}`)
  }, [])

  // * App Hash
  const {
    hash: appHash,
    loading: hashLoading,
    error: hashError,
    refetch: refetchHash,
  } = useGetHash({
    onSuccess: onSuccessHash,
    onError: onErrorHash,
  })

  // * SMS/OTP Listener
  const {
    isListening,
    loading: otpLoading,
    receivedOtp,
    receivedMessage,
    error: otpError,
    startListener,
    stopListener,
  } = useOtpListener({
    onOtpReceived: (otp, message) => {
      console.log('OTP Received:', otp, message)
      addStatusMessage('success', `OTP Received: ${otp}`)
    },
    onTimeout: (message) => {
      console.log('Timeout:', message)
      addStatusMessage('error', 'SMS verification timed out. Please try again.')
    },
    onError: (error, code) => {
      console.log('Error:', error, code)
      let errorMessage = `Error: ${error}`

      // Add specific error messages based on error codes
      switch (code) {
        case -1001:
          errorMessage = 'SMS receiver error: Invalid intent data'
          break
        case -1002:
          errorMessage = 'SMS receiver error: Invalid status'
          break
        case -1003:
          errorMessage = 'SMS receiver error: Status parsing failed'
          break
        case -1004:
          errorMessage = 'SMS receiver error: Empty message'
          break
        default:
          if (code !== -1) {
            errorMessage += ` (Code: ${code})`
          }
      }

      addStatusMessage('error', errorMessage)
    },
  })

  const addStatusMessage = (type: StatusMessage['type'], message: string) => {
    const newMessage: StatusMessage = {
      type,
      message,
      timestamp: Date.now(),
    }
    setStatusMessages((prev) => [newMessage, ...prev.slice(0, 4)]) // Keep last 5 messages
  }

  const clearStatusMessages = () => {
    setStatusMessages([])
  }

  const copyAppHash = async () => {
    if (appHash) {
      await Clipboard.setStringAsync(appHash)
      addStatusMessage('success', 'App hash copied to clipboard')
    }
  }

  const handleStartListener = async () => {
    if (isListening) {
      addStatusMessage('warning', 'SMS listener is already active')
      return
    }

    try {
      await startListener()
      addStatusMessage('info', 'SMS Listener Started - Waiting for SMS...')
    } catch (error) {
      console.error(error)
      addStatusMessage('error', 'Failed to start SMS listener')
    }
  }

  const handleStopListener = () => {
    stopListener()
    addStatusMessage('info', 'SMS verification has been cancelled')
  }

  const clearResults = () => {
    clearStatusMessages()
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>SMS Verification Example</Text>

        {/* App Hash Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Signature Hash</Text>
          <TouchableOpacity
            style={styles.hashContainer}
            onPress={copyAppHash}
            disabled={!appHash}
          >
            <Text style={[styles.hashText, { userSelect: 'text' }]} selectable>
              {appHash || 'Loading...'}
            </Text>
            {appHash && <Text style={styles.copyHint}>Tap to copy</Text>}
          </TouchableOpacity>

          <View style={styles.hashButtonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.secondaryButton,
                hashLoading && styles.buttonDisabled,
              ]}
              onPress={refetchHash}
              disabled={hashLoading}
            >
              {hashLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Refresh Hash</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.helpText}>
            Include this hash in your SMS messages for automatic detection{'\n'}
            The module will automatically retry failed operations up to 3 times.
          </Text>
        </View>

        {/* SMS Listener Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SMS Verification</Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.primaryButton,
                (isListening || otpLoading || hashLoading) &&
                  styles.buttonDisabled,
              ]}
              onPress={handleStartListener}
              disabled={isListening || otpLoading || hashLoading}
            >
              {otpLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {isListening ? 'Listening for SMS...' : 'Start SMS Listener'}
                </Text>
              )}
            </TouchableOpacity>

            {isListening && (
              <TouchableOpacity
                style={[styles.button, styles.dangerButton]}
                onPress={handleStopListener}
              >
                <Text style={styles.buttonText}>Stop Listening</Text>
              </TouchableOpacity>
            )}
          </View>

          {isListening && (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.statusText}>Waiting for SMS...</Text>
            </View>
          )}
        </View>

        {/* Results Section */}
        {(receivedOtp || receivedMessage || otpError || hashError) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Results</Text>

            {receivedOtp && (
              <View style={styles.resultContainer}>
                <Text style={styles.resultTitle}>✅ SMS Received</Text>
                <Text style={styles.resultText}>OTP: {receivedOtp}</Text>
                {receivedMessage && (
                  <Text style={styles.resultText}>
                    Message: {receivedMessage}
                  </Text>
                )}
              </View>
            )}

            {(otpError || hashError) && (
              <View style={[styles.resultContainer, styles.errorContainer]}>
                <Text style={styles.errorTitle}>❌ Error</Text>
                <Text style={styles.errorText}>
                  {otpError || hashError?.message}
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.clearButton} onPress={clearResults}>
              <Text style={styles.clearButtonText}>Clear Results</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Status Messages Section */}
        {statusMessages.length > 0 && (
          <View style={styles.section}>
            <View style={styles.statusHeader}>
              <Text style={styles.sectionTitle}>Status Messages</Text>
              <TouchableOpacity
                style={styles.clearStatusButton}
                onPress={clearStatusMessages}
              >
                <Text style={styles.clearStatusText}>Clear</Text>
              </TouchableOpacity>
            </View>

            {statusMessages.map((message, index) => {
              const getStatusStyle = () => {
                switch (message.type) {
                  case 'success':
                    return styles.statusSuccess
                  case 'error':
                    return styles.statusError
                  case 'warning':
                    return styles.statusWarning
                  case 'info':
                    return styles.statusInfo
                  default:
                    return styles.statusInfo
                }
              }

              return (
                <View
                  key={`${message.timestamp}-${index}`}
                  style={[styles.statusMessage, getStatusStyle()]}
                >
                  <Text style={styles.statusMessageText}>
                    {message.type === 'success' && '✅ '}
                    {message.type === 'error' && '❌ '}
                    {message.type === 'warning' && '⚠️ '}
                    {message.type === 'info' && 'ℹ️ '}
                    {message.message}
                  </Text>
                  <Text style={styles.statusTimestamp}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
              )
            })}
          </View>
        )}

        {/* Instructions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How to Test</Text>
          <Text style={styles.instructionText}>
            1. Copy your app hash from above{'\n'}
            2. Start the SMS listener{'\n'}
            3. Send an SMS to this device with any of these formats:{'\n'}•
            &quot;Your OTP is 123456 {appHash}&quot;{'\n'}• &quot;Code: 123456{' '}
            {appHash}&quot;{'\n'}• &quot;Verification code 123456 {appHash}
            &quot;{'\n'}• &quot;123456&quot; (with hash in message){'\n\n'}
            The SMS will be automatically detected and the OTP extracted.{'\n'}
            The module supports various OTP formats and will retry failed
            operations.
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  hashContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  hashText: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#495057',
    textAlign: 'center',
  },
  copyHint: {
    fontSize: 10,
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
  helpText: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  buttonContainer: {
    gap: 10,
  },
  hashButtonContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#34C759',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    padding: 10,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#1976d2',
  },
  resultContainer: {
    backgroundColor: '#e8f5e8',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  errorContainer: {
    backgroundColor: '#ffeaea',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d32f2f',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 14,
    color: '#2e7d32',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#d32f2f',
  },
  clearButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  instructionText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#495057',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  clearStatusButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  clearStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  statusMessage: {
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
  },
  statusSuccess: {
    backgroundColor: '#e8f5e8',
    borderLeftColor: '#2e7d32',
  },
  statusError: {
    backgroundColor: '#ffeaea',
    borderLeftColor: '#d32f2f',
  },
  statusWarning: {
    backgroundColor: '#fff3cd',
    borderLeftColor: '#f57c00',
  },
  statusInfo: {
    backgroundColor: '#e3f2fd',
    borderLeftColor: '#1976d2',
  },
  statusMessageText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  statusTimestamp: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
  },
})
