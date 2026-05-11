const PROD = process.env.NODE_ENV === 'production';

export const dbg = PROD ? () => {} : (...args) => console.log(...args);
export const dbgWarn = PROD ? () => {} : (...args) => console.warn(...args);
export const dbgError = PROD ? () => {} : (...args) => console.error(...args);
