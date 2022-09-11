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
  { name: 'Pm3Hf14a', input: 'plugin/Hf14a', output: 'plugin/Hf14a' },
  { name: 'Pm3LoggerRxTx', input: 'plugin/LoggerRxTx', output: 'plugin/LoggerRxTx' },
  { name: 'Pm3Waveshare', input: 'plugin/Waveshare', output: 'plugin/Waveshare' },
  { name: 'Pm3WebserialAdapter', input: 'plugin/WebserialAdapter', output: 'plugin/WebserialAdapter' },
  { name: 'Proxmark3', input: 'main', output: 'proxmark3' },
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
