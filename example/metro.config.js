const path = require('path')
const { getDefaultConfig } = require('@react-native/metro-config')
const { withMetroConfig } = require('react-native-monorepo-config')

const root = path.resolve(__dirname, '..')

module.exports = withMetroConfig(getDefaultConfig(__dirname), {
  root,
  dirname: __dirname,
  // Not a workspace: the library at the root is the only other package.
  workspaces: [],
  conditions: ['avasapp-react-native-otp-autofill-source'],
})
