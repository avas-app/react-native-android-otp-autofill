import { Text, View } from 'react-native'

import React from 'react'
import { styles } from '../styles'

interface InstructionsSectionProps {
  appHash: string | null
}

export const InstructionsSection: React.FC<InstructionsSectionProps> = ({
  appHash,
}) => {
  return (
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
  )
}