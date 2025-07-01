import { database } from './database/index.mjs';

const path = location.pathname;

const isHomePage = () => ['/', '/index.html'].includes(path);
const isWatchPage = () => ['/watch/index.html', '/watch/'].includes(path);
const isPlayerPage = () => ['/watch/player/index.html', '/watch/player/'].includes(path);

let UIrequests = {
	common: isHomePage() || isWatchPage() ? loadCommonUI() : null,
	home: isHomePage() ? loadHomeUI() : null,
	watch: isWatchPage() ? loadWatchUI() : null,
	player: isPlayerPage() ? loadPlayerUI() : null,
};

database.export();
initApp();

async function initApp() {
	debugMode(false);
	activateTimer();
	await Promise.all([DOMLoaded(), ...Object.values(UIrequests).filter(Boolean)]);

	if (UIrequests.common) (await UIrequests.common).init(database);
	if (UIrequests.home) (await UIrequests.home).init(database);
	if (UIrequests.watch) (await UIrequests.watch).init(database);
	if (UIrequests.player) (await UIrequests.player).init(database);

	console.timeEnd('--> [App.timer]: App ready time');
}

function activateTimer() {
	console.time('--> [App.timer]: DOM ready time');
	console.time('--> [App.timer]: App ready time');
	console.time('--> [App.timer]: App load time');
	window.addEventListener('load', () => console.timeEnd('--> [App.timer]: App load time'));
}

async function DOMLoaded() {
	return new Promise((resolve) => {
		const callback = () => {
			console.timeEnd('--> [App.timer]: DOM ready time');
			resolve();
		};
		if (document.readyState !== 'loading') callback();
		else document.addEventListener('DOMContentLoaded', callback, { once: true });
	});
}

function debugMode(on = false) {
	if (!on) return;

	const originalEncodeURI = window.encodeURI;
	window.encodeURI = (uri) => {
		const encodedURI = originalEncodeURI(uri);
		console.log(`--> [Debugger]: Encoded URI: ${uri} --> ${encodedURI}`);
		return encodedURI;
	};
}

async function loadCommonUI() {
	return import('./UIs/common.mjs');
}

async function loadHomeUI() {
	return import('./UIs/home.mjs');
}

async function loadWatchUI() {
	return import('./UIs/watch.mjs');
}

async function loadPlayerUI() {
	return import('./UIs/player.mjs');
}
