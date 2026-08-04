import type { CapacitorConfig } from '@capacitor/cli'

// NOTE: appId is a placeholder reverse-domain identifier (no registered
// "bermi" domain was found in this repo). Change it to match your actual
// Apple Developer / Google Play registration BEFORE your first store
// submission — the appId becomes your app's permanent bundle/package ID
// and is very disruptive to change after publishing.
const config: CapacitorConfig = {
  appId: 'ai.bermi.app',
  appName: 'Bermi AI',
  webDir: 'dist',
  backgroundColor: '#FAFAF8',
  ios: {
    contentInset: 'always',
  },
  android: {
    backgroundColor: '#FAFAF8',
  },
}

export default config
