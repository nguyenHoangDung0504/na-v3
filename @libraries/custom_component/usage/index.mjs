import { queryComponent } from '../index.mjs';
import AppHeader from './components/app-header.mjs';
import AppRoot from './components/app-root.mjs';

const appRoot = queryComponent(document, AppRoot);
const appHeader = queryComponent(appRoot, AppHeader);
appHeader.applyModel({ userName: 'Dungx', view: { placeHolder: 'Search...' } });
appHeader.render();

console.log(
	'==================================================================================='
);
console.log(appRoot);
