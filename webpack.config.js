const { ModifyEntryPlugin } = require('@angular-architects/module-federation/src/utils/modify-entry-plugin')
const { share, withModuleFederationPlugin } = require('@angular-architects/module-federation/webpack')

const config = withModuleFederationPlugin({
  name: 'onecx-permission-ui',
  filename: 'remoteEntry.js',
  exposes: {
    './OneCXPermissionModule': 'src/bootstrap.ts',
    './OneCXUserRolesPermissionsComponent':
      'src/app/remotes/user-roles-permissions/user-roles-permissions.component.bootstrap.ts'
  },
  shared: share({
    '@angular/core': { singleton: true, requiredVersion: 'auto' },
    '@angular/forms': {
      singleton: true,
      requiredVersion: 'auto',
      includeSecondaries: true,
      eager: false
    },
    '@angular/common': {
      singleton: true,
      requiredVersion: 'auto',
      includeSecondaries: {
        skip: ['@angular/common/http/testing']
      }
    },
    '@angular/common/http': {
      singleton: true,
      requiredVersion: 'auto',
      includeSecondaries: true
    },
    '@angular/router': { singleton: true, requiredVersion: 'auto', includeSecondaries: true },
    rxjs: { requiredVersion: 'auto', includeSecondaries: true },
    '@ngx-translate/core': { singleton: true, requiredVersion: 'auto' },
    '@onecx/accelerator': { requiredVersion: 'auto', includeSecondaries: true },
    '@onecx/integration-interface': { requiredVersion: 'auto', includeSecondaries: true },
    '@onecx/keycloak-auth': { requiredVersion: 'auto', includeSecondaries: true },
    '@onecx/portal-integration-angular': { requiredVersion: 'auto', includeSecondaries: true },
    '@onecx/angular-remote-components': { requiredVersion: 'auto', includeSecondaries: true }
  }),
  sharedMappings: ['@onecx/portal-integration-angular']
})
config.devServer = {
  allowedHosts: 'all'
}

const plugins = config.plugins.filter((plugin) => !(plugin instanceof ModifyEntryPlugin))

module.exports = {
  ...config,
  plugins,
  output: {
    uniqueName: 'onecx-help-ui',
    publicPath: 'auto'
  },
  experiments: {
    ...config.experiments,
    topLevelAwait: true
  },
  optimization: {
    runtimeChunk: false,
    splitChunks: false
  }
}
