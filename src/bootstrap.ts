import { bootstrapModule } from '@onecx/angular-webcomponents'

import { environment } from 'src/environments/environment'
import { OneCXPermissionModule } from './app/onecx-permission-remote.module'

bootstrapModule(OneCXPermissionModule, 'microfrontend', environment.production)
