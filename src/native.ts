import type { Spec } from './NativeOtpAutofill'

// SMS Retriever is Android-only, so other platforms never look the module up.
const native: Spec | null = null

export default native
