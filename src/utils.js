export const logTime = (...args) => console.log(`[${new Date().toTimeString().slice(0, 8)}]`, ...args)

export const sleep = t => new Promise(resolve => setTimeout(resolve, t))

export class RethrownError extends Error {
  constructor (err) {
    if (!(err instanceof Error)) throw new TypeError('invalid err type')
    super(err.message)
    this.name = this.constructor.name
    this.originalError = err
    this.stack = `${this.stack}\n${err.stack}`
  }
}

export const retry = async (fn, times = 3) => {
  if (times < 1) throw new TypeError('invalid times')
  let lastErr = null
  while (times--) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
    }
  }
  throw new RethrownError(lastErr)
}
