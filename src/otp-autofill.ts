import AvasOtpAutofillModule from './AvasOtpAutofillModule'
import { EventSubscription } from 'expo-modules-core'
import { SmsReceivedEventPayload } from './AvasOtpAutofill.types'

export * from './AvasOtpAutofill.types'

// Define the interface that matches your requirements with updated API
interface OtpVerify {
  getOtp: () => Promise<() => void>
  getHash: () => Promise<string[]>
  requestHint: () => Promise<string>
  startOtpListener: (handler: (value: string) => any) => Promise<() => void>
  addListener: (handler: (value: string) => any) => EventSubscription
}

// Internal state to manage listeners
let currentEventSubscription: EventSubscription | null = null

// Create a wrapper that implements the exact interface you want
const createOtpVerify = (): OtpVerify => ({
  getOtp: async () => {
    await AvasOtpAutofillModule.getOtp()
    // Return a function that stops the SMS retriever
    return () => {
      // The native side automatically stops after receiving SMS or timeout
      // We'll provide cleanup functionality here if needed
      if (currentEventSubscription) {
        currentEventSubscription.remove()
        currentEventSubscription = null
      }
    }
  },

  getHash: () => AvasOtpAutofillModule.getHash(),
  requestHint: () => AvasOtpAutofillModule.requestHint(),

  startOtpListener: async (
    handler: (value: string) => any,
  ): Promise<() => void> => {
    // Clean up any existing subscription
    if (currentEventSubscription) {
      currentEventSubscription.remove()
    }

    // Add event listener first
    currentEventSubscription = AvasOtpAutofillModule.addListener(
      'onSmsReceived',
      (event: SmsReceivedEventPayload) => {
        if (event.otp) {
          handler(event.otp)
        }
      },
    )

    // Start the SMS listener
    await AvasOtpAutofillModule.startOtpListener()

    // Return unsubscribe function
    return () => {
      if (currentEventSubscription) {
        currentEventSubscription.remove()
        currentEventSubscription = null
      }
      // Note: Native side handles SMS retriever cleanup automatically
    }
  },

  addListener: (handler: (value: string) => any): EventSubscription =>
    AvasOtpAutofillModule.addListener(
      'onSmsReceived',
      (event: SmsReceivedEventPayload) => {
        if (event.otp) {
          handler(event.otp)
        }
      },
    ),
})

// Export the module as default
export default createOtpVerify()

// Also export the raw module if needed
export { AvasOtpAutofillModule }
