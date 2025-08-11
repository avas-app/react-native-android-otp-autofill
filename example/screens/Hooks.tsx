import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import React, { useCallback, useState } from 'react'
import { useGetHash, useOtpListener } from '../../src'

import { AppHashSection } from '../components/AppHashSection'
import { InstructionsSection } from '../components/InstructionsSection'
import { StatusMessage } from '../types'
import { StatusMessages } from '../components/StatusMessages'
import { styles } from '../styles'

export const Hooks: React.FC = () => {
  const [statusMessages, setStatusMessages] = useState<StatusMessage[]>([])

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

  // Ensure that the callbacks are not recreated on every render
  const onSuccessHash = useCallback((hash: string) => {
    addStatusMessage('success', `App hash loaded: ${hash.substring(0, 8)}...`)
  }, [])
  const onErrorHash = useCallback((error: Error) => {
    addStatusMessage('error', `Failed to load app hash: ${error.message}`)
  }, [])

  // App Hash
  const {
    hash: appHash,
    loading: hashLoading,
    error: hashError,
    refetch: refetchHash,
  } = useGetHash({
    onSuccess: onSuccessHash,
    onError: onErrorHash,
  })

  // SMS/OTP Listener
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <AppHashSection
          appHash={appHash}
          hashLoading={hashLoading}
          onRefetch={refetchHash}
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