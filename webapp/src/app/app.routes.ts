import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Flash } from './pages/flash/flash';
import { Debug } from './pages/debug/debug';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'home'
  },
  {
    path: 'home',
    component: Home,
    title: 'Home'
  },
  {
    path: 'flash',
    component: Flash,
    title: 'Flash'
  },
  {
    path: 'debug',
    component: Debug,
    title: 'Debug'
  }
];
