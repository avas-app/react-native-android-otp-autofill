import * as Clipboard from 'expo-clipboard'

import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import React from 'react'
import { StatusMessage } from '../types'
import { styles } from '../styles'

interface AppHashSectionProps {
  appHash: string | null
  hashLoading: boolean
  onRefetch: () => void
  onStatusMessage: (type: StatusMessage['type'], message: string) => void
}

export const AppHashSection: React.FC<AppHashSectionProps> = ({
  appHash,
  hashLoading,
  onRefetch,
  onStatusMessage,
}) => {
  const copyAppHash = async () => {
    if (appHash) {
      await Clipboard.setStringAsync(appHash)
      onStatusMessage('success', 'App hash copied to clipboard')
    }
  }

  return (
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
          onPress={onRefetch}
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
  )
}