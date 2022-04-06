import _ from 'lodash'

export const logTime = (...args) => console.log(`[${new Date().toTimeString().slice(0, 8)}]`, ...args)

export const sleep = t => new Promise(resolve => setTimeout(resolve, t))

export const uintToPadHex = (num, len) => {
  return _.padStart(num.toString(16), len, '0')
}
