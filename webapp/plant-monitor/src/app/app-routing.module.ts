import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { PlantMonitorComponent } from './plant-monitor/plant-monitor.component';
import { AngularFireAuthGuard, redirectUnauthorizedTo, redirectLoggedInTo, canActivate } from '@angular/fire/auth-guard';

const redirectUnauthorizedToLogin = () => redirectUnauthorizedTo(['login']);
const redirectLoggedInToMonitor = () => redirectLoggedInTo([''])

const routes: Routes = [
  {path: '', component:PlantMonitorComponent, ...canActivate(redirectUnauthorizedToLogin)},
  {path: 'login', component: LoginComponent, ...canActivate(redirectLoggedInToMonitor)}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
