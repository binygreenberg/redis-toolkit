module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    node: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    'max-len': ['error', { code: 140 }],
    'no-console': 'off',
    'prefer-destructuring': ['error', {
      array: false,
      object: true,
    }],
    'no-await-in-loop': 'off',
  },
};
