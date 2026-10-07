const path = require('path')
const pkg = require('../package.json')

module.exports = {
  dependencies: {
    [pkg.name]: {
      root: path.join(__dirname, '..'),
      platforms: {
        // The codegen script fails without explicit platform entries.
        ios: null,
        android: {},
      },
    },
  },
}
