import _ from 'lodash'
import json from '@rollup/plugin-json'
import { terser } from 'rollup-plugin-terser'

const configBrowser = {
  format: 'umd',
  globals: {
    lodash: '_',
  },
}

const configs = _.map([
  { name: 'Proxmark3', input: 'main', output: 'proxmark3' },
  { name: 'Pm3Waveshare', input: 'plugin/Waveshare', output: 'plugin/waveshare' },
], arg => ({
  input: `src/${arg.input}.js`,
  plugins: [json()],
  external: [
    'lodash',
  ],
  output: [
    {
      ...configBrowser,
      name: arg.name,
      file: `dist/${arg.output}.js`,
    },
    {
      ...configBrowser,
      name: arg.name,
      file: `dist/${arg.output}.min.js`,
      plugins: [terser()],
    },
  ],
}))

export default configs
