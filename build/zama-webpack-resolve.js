const path = require('path');
const webpack = require('webpack');

/**
 * Force a single @zama-fhe/sdk instance in ui.js. Duplicate ESM copies break
 * CredentialsManager.computeStoreKey (useAllow / decrypt) in production bundles.
 */
function createZamaWebpackResolve(rootDir) {
  const zamaSdkEsm = path.join(rootDir, 'node_modules/@zama-fhe/sdk/dist/esm');
  const zamaReactSdk = path.join(
    rootDir,
    'node_modules/@zama-fhe/react-sdk/dist/index.js'
  );

  const alias = {
    '@zama-fhe/react-sdk': zamaReactSdk,
    '@zama-fhe/sdk': zamaSdkEsm,
    '@zama-fhe/sdk/query': path.join(zamaSdkEsm, 'query/index.js'),
    '@zama-fhe/sdk/viem': path.join(zamaSdkEsm, 'viem/index.js'),
    '@zama-fhe/sdk/cleartext': path.join(zamaSdkEsm, 'cleartext/index.js'),
  };

  const plugins = [
    new webpack.NormalModuleReplacementPlugin(
      /^@zama-fhe\/sdk$/,
      path.join(zamaSdkEsm, 'index.js')
    ),
    new webpack.NormalModuleReplacementPlugin(
      /^@zama-fhe\/sdk\/query$/,
      path.join(zamaSdkEsm, 'query/index.js')
    ),
    new webpack.NormalModuleReplacementPlugin(
      /^@zama-fhe\/sdk\/viem$/,
      path.join(zamaSdkEsm, 'viem/index.js')
    ),
    new webpack.NormalModuleReplacementPlugin(
      /^@zama-fhe\/sdk\/cleartext$/,
      path.join(zamaSdkEsm, 'cleartext/index.js')
    ),
  ];

  return { alias, plugins, zamaSdkEsm };
}

module.exports = { createZamaWebpackResolve };
