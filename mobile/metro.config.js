const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix for react-native-maps web codegen error
// Specifically in newer RN versions, codegenNativeComponent is used for native specs
// which is missing in react-native-web.
if (config.resolver) {
  const originalResolveRequest = config.resolver.resolveRequest;
  
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    // If the bundler is looking for the codegen utility on Web, give it our shim
    if (
      platform === 'web' && 
      (moduleName === 'react-native/Libraries/Utilities/codegenNativeComponent' ||
       moduleName === '../Utilities/codegenNativeComponent')
    ) {
      return {
        type: 'sourceFile',
        filePath: path.resolve(__dirname, 'web-codegen-shim.js'),
      };
    }
    
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
