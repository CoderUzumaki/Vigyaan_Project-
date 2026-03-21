/**
 * Simple shim for codegenNativeComponent on Web.
 * react-native-maps uses this at runtime which fails on Web.
 */
module.exports = function codegenNativeComponent(name) {
  return name;
};
