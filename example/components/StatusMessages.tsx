import { Text, TouchableOpacity, View } from 'react-native'

import React from 'react'
import { StatusMessage } from '../types'
import { styles } from '../styles'

interface StatusMessagesProps {
  statusMessages: StatusMessage[]
  onClear: () => void
}

export const StatusMessages: React.FC<StatusMessagesProps> = ({
  statusMessages,
  onClear,
}) => {
  if (statusMessages.length === 0) return null

  return (
    <View style={styles.section}>
      <View style={styles.statusHeader}>
        <Text style={styles.sectionTitle}>Status Messages</Text>
        <TouchableOpacity style={styles.clearStatusButton} onPress={onClear}>
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
  )
}