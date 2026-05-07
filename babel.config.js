module.exports = {
  env: {
    test: {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
      ],
    },
    production: {
      // Strip all console.* calls from the production bundle so internal
      // endpoint paths, BC wrapper diagnostics, and request/response dumps
      // never reach end users. Dev builds keep console output for debugging.
      plugins: [
        ['transform-remove-console'],
      ],
    },
  },
};
