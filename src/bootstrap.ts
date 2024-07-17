import { environment } from 'src/environments/environment'
import { OneCXPermissionModule } from './app/onecx-permission-remote.module'
import { bootstrapModule } from '@onecx/angular-webcomponents'

bootstrapModule(OneCXPermissionModule, 'microfrontend', environment.production)
