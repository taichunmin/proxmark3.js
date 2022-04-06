import json from '@rollup/plugin-json'
import { terser } from 'rollup-plugin-terser'

const configBrowser = {
  format: 'umd',
  name: 'Proxmark3',
  globals: {
    lodash: '_',
  },
}

export default {
  input: 'src/main.js',
  plugins: [json()],
  external: [
    'lodash',
  ],
  output: [
    {
      file: 'dist/proxmark3.js',
      ...configBrowser,
    },
    {
      file: 'dist/proxmark3.min.js',
      plugins: [terser()],
      ...configBrowser,
    },
  ],
}
