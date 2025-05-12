import { queryComponent } from '../src/index.mjs';
import AppHeader from './components/app-header.mjs';
import AppRoot from './components/app-root.mjs';

const appRoot = queryComponent(document, AppRoot);
const appHeader = queryComponent(appRoot, AppHeader);
appHeader.applyModel({ userName: 'Dungx', placeHolder: 'Search...' });

console.log('===================================================================================');
console.log(appRoot);
