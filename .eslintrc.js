module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    'react-native/no-inline-styles': 'off', // theme colors come from useTheme(), so styles are inline by design
  },
};
