// Export the simplified otp-autofill module
// Keep backward compatibility by re-exporting the old interface
import AvasOtpAutofill from './otp-autofill'

export { default as AvasOtpAutofill, AvasOtpAutofillModule } from './otp-autofill'

// Export all types
export * from './AvasOtpAutofill.types'

// Export the new hooks-based API
export * from './hooks'
export default AvasOtpAutofill
