import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import React, { useCallback, useEffect, useState } from 'react'

import { AppHashSection } from '../components/AppHashSection'
import AvasOtpAutofillModule from '../../src/AvasOtpAutofillModule'
import { EventSubscription } from 'expo-modules-core'
import { InstructionsSection } from '../components/InstructionsSection'
// For manual implementation, we use the actual module methods directly
// This shows how you might implement the functionality without using hooks
import { StatusMessage } from '../types'
import { StatusMessages } from '../components/StatusMessages'
import { styles } from '../styles'

// Manual method wrappers around the native module
const getAppHashManual = async (): Promise<string> => {
  const hashes = await AvasOtpAutofillModule.getHash()
  if (Array.isArray(hashes) && hashes.length > 0) {
    return hashes[0]
  }
  throw new Error('No app hash found')
}

let subscriptions: EventSubscription[] = []

let i = 0

const startOtpListenerManual = async (callbacks: {
  onOtpReceived: (otp: string, message: string) => void
  onTimeout: (message: string) => void
  onError: (error: string, code: number) => void
}): Promise<void> => {
  // Stop any existing listener
  stopOtpListenerManual()

  const subReceived = AvasOtpAutofillModule.addListener('onSmsReceived', ({ otp, message }) => {
    if (otp) {
      callbacks.onOtpReceived(otp, `listener ${i++}: ${message}`)
    }
  })
  subscriptions.push(subReceived)

  const subTimeout = AvasOtpAutofillModule.addListener('onTimeout', ({ message }) => {
    callbacks.onTimeout(`listener ${i++}: ${message}`)
  })
  subscriptions.push(subTimeout)

  const subError = AvasOtpAutofillModule.addListener('onError', ({ message, code }) => {
    callbacks.onError(`listener ${i++}: ${message}`, code)
  })
  subscriptions.push(subError)

  // Start the OTP listener
  await AvasOtpAutofillModule.startOtpListener()
}

const stopOtpListenerManual = (): void => {
  if (subscriptions.length) {
    subscriptions.forEach((s) => s.remove())
    subscriptions = []
  }
  AvasOtpAutofillModule.stopSmsRetriever()
}

export const Manual: React.FC = () => {
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([])
  const [appHash, setAppHash] = useState<string | null>(null)
  const [hashLoading, setHashLoading] = useState(false)
  const [hashError, setHashError] = useState<Error | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [receivedOtp, setReceivedOtp] = useState<string | null>(null)
  const [receivedMessage, setReceivedMessage] = useState<string | null>(null)
  const [otpError, setOtpError] = useState<string | null>(null)

  const addStatusMessage = useCallback((type: StatusMessage['type'], message: string) => {
    const newMessage: StatusMessage = {
      type,
      message,
      timestamp: Date.now(),
    }
    setStatusMessages((prev) => [newMessage, ...prev.slice(0, 4)]) // Keep last 5 messages
  }, [])

  const clearStatusMessages = () => {
    setStatusMessages([])
  }

  const loadAppHash = useCallback(async () => {
    setHashLoading(true)
    setHashError(null)
    
    try {
      const hash = await getAppHashManual()
      setAppHash(hash)
      addStatusMessage('success', `App hash loaded: ${hash.substring(0, 8)}...`)
    } catch (error) {
      const err = error as Error
      setHashError(err)
      addStatusMessage('error', `Failed to load app hash: ${err.message}`)
    } finally {
      setHashLoading(false)
    }
  }, [addStatusMessage])

  const handleStartListener = async () => {
    if (isListening) {
      addStatusMessage('warning', 'SMS listener is already active')
      return
    }

    setOtpLoading(true)
    setIsListening(true)
    setReceivedOtp(null)
    setReceivedMessage(null)
    setOtpError(null)

    try {
      await startOtpListenerManual({
        onOtpReceived: (otp: string, message: string) => {
          console.log('OTP Received:', otp, message)
          setReceivedOtp(otp)
          setReceivedMessage(message)
          setIsListening(false)
          setOtpLoading(false)
          addStatusMessage('success', `OTP Received: ${otp}`)
        },
        onTimeout: (message: string) => {
          console.log('Timeout:', message)
          setIsListening(false)
          setOtpLoading(false)
          addStatusMessage('error', 'SMS verification timed out. Please try again.')
        },
        onError: (error: string, code: number) => {
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

          setOtpError(errorMessage)
          setIsListening(false)
          setOtpLoading(false)
          addStatusMessage('error', errorMessage)
        },
      })

      addStatusMessage('info', 'SMS Listener Started - Waiting for SMS...')
    } catch (error) {
      console.error(error)
      setOtpLoading(false)
      setIsListening(false)
      addStatusMessage('error', 'Failed to start SMS listener')
    }
  }

  const handleStopListener = () => {
    try {
      stopOtpListenerManual()
      setIsListening(false)
      setOtpLoading(false)
      addStatusMessage('info', 'SMS verification has been cancelled')
    } catch (error) {
      console.error(error)
      addStatusMessage('error', 'Failed to stop SMS listener')
    }
  }

  const clearResults = () => {
    setReceivedOtp(null)
    setReceivedMessage(null)
    setOtpError(null)
    setHashError(null)
    clearStatusMessages()
  }

  // Load app hash on component mount
  useEffect(() => {
    loadAppHash()
  }, [loadAppHash])

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <AppHashSection
          appHash={appHash}
          hashLoading={hashLoading}
          onRefetch={loadAppHash}
          onStatusMessage={addStatusMessage}
        />

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

        <StatusMessages
          statusMessages={statusMessages}
          onClear={clearStatusMessages}
        />

        <InstructionsSection appHash={appHash} />
      </ScrollView>
    </View>
  )
}