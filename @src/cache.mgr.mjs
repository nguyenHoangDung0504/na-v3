const WORKER_PATH = '/cache.worker.mjs';
const cacheManager = {
	clearCache,
	unregisterWorker,
};

window.cacheManager = this;
export default cacheManager;

if ('serviceWorker' in navigator) {
	navigator.serviceWorker.getRegistration().then((registration) => {
		if (registration) {
			console.log('--> [CacheManager]: Service Worker already registered.');
			return;
		}

		navigator.serviceWorker
			.register(WORKER_PATH)
			.then((reg) => {
				console.log('--> [CacheManager]: Service Worker registered with scope:', reg.scope);
				reg.addEventListener('message', (event) => {
					if (event.data.status === 'CACHE_CLEARED') {
						console.log('--> [CacheManager]: Cache has been cleared successfully.');
					}
				});
			})
			.catch((error) => {
				console.error('--> [CacheManager]: Service Worker registration failed:', error);
			});
	});
}

async function clearCache() {
	const registration = await navigator.serviceWorker.ready;
	if (registration.active) {
		registration.active.postMessage({ type: 'CLEAR_CACHE' });
		console.log('--> [CacheManager]: Cache clear request sent.');
	} else {
		console.warn('--> [CacheManager]: No active Service Worker to handle cache clearing.');
	}
}

async function unregisterWorker() {
	if ('serviceWorker' in navigator) {
		const registrations = await navigator.serviceWorker.getRegistrations();
		for (let registration of registrations) {
			await registration.unregister();
			console.log('--> [CacheManager]: Service Worker unregistered');
		}
	}
}
