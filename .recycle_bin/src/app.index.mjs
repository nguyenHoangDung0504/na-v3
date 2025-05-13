import Database from './app.database.mjs';

const path = location.pathname;
const dbRequest = initDB();

const isHomePage = () => ['/', '/index.html'].includes(path);
const isWatchPage = () => ['/watch/index.html', '/watch/'].includes(path);
const isPlayerPage = () => ['/player/index.html', '/player/'].includes(path);

let UIrequests = {
	common: isHomePage() || isWatchPage() ? loadCommonUI() : null,
	home: isHomePage() ? loadHomeUI() : null,
	watch: isWatchPage() ? loadWatchUI() : null,
	player: isPlayerPage() ? loadPlayerUI() : null,
};

initApp();

async function initApp() {
	activateTimer();
	const [database] = await Promise.all([dbRequest, DOMLoaded(), ...Object.values(UIrequests).filter(Boolean)]);
	if (UIrequests.common) (await UIrequests.common).initialize(database);
}

function activateTimer() {
	console.time('--> [App.timer]: Build database time');
	console.time('--> [App.timer]: DOM ready time');
}

async function initDB() {
	try {
		const database = (await Database.create()).export();
		console.timeEnd('--> [App.timer]: Build database time');
		console.log('--> [App.initDB]: Database debug:', database);
		return database;
	} catch (error) {
		console.error('--> [App.initDB]: Database initialization failed:', error);
		console.timeEnd('--> [App.timer]: Build database time');
		return null;
	}
}

async function DOMLoaded() {
	return new Promise((resolve) => {
		if (document.readyState !== 'loading') resolve();
		else document.addEventListener('DOMContentLoaded', resolve, { once: true });
	});
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
