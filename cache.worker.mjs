const CACHE_NAME = 'na-v3.cache'
const CACHE_VERSION = 6
const CACHE_EXPIRATION = time({ minutes: 10 })
const LOG = true

const cacheTargets = buildCacheTargets`
	-- External CSS
	https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta2/css/all.min.css
	https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css

	-- Path
	/@components/*
	/@descriptions/*
	/@libraries/*
	/@resources/*
    /@src/*

	/           --ignore-params
	/watch/*    --ignore-params
`
console.log('--> [CacheManager.worker]: Using cache rules:', cacheTargets)

/**
 * @typedef {{ pattern: string; ignoreParam?: boolean; }} CacheTarget
 */

/**
 * Build danh sách cache target từ một chuỗi ngăn cách bởi `\n`
 * @param {string} targets
 * @returns {CacheTarget[]}
 */
function buildCacheTargets(targets, ..._) {
	return targets[0]
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.filter((line) => !line.startsWith('--'))
		.map((line) => {
			const ignoreParam = line.includes('--ignore-params')
			const pattern = line.replace('--ignore-params', '').trim()
			return { pattern, ignoreParam }
		})
}

function getFullCacheName() {
	return `${CACHE_NAME}/v=${CACHE_VERSION}`
}

/**
 * Helper giúp chuyển thời gian thành milisecond
 * @param {Object} [param0={}]
 * @param {number} [param0.hours=0]
 * @param {number} [param0.minutes=0]
 * @param {number} [param0.seconds=0]
 */
function time({ hours = 0, minutes = 0, seconds = 0 } = {}) {
	hours ??= 0
	minutes ??= 0
	seconds ??= 0
	return 1000 * (hours * 60 ** 2 + minutes * 60 + seconds)
}

/**
 * Trả về rule phù hợp đầu tiên với URL, hoặc null nếu không có
 * @param {string | URL} inputUrl
 * @returns {CacheTarget | null}
 */
function getMatchingRule(inputUrl) {
	const url = typeof inputUrl === 'string' ? new URL(inputUrl) : inputUrl
	const { origin, pathname, href } = url

	if (origin.startsWith('chrome-extension:')) return null

	for (const rule of cacheTargets) {
		const { pattern, ignoreParam } = rule
		const urlToCompare = ignoreParam ? `${origin}${pathname}` : href

		// So khớp tuyệt đối nếu là URL
		if (pattern.startsWith('http')) {
			if (urlToCompare === pattern) return rule
		}

		// So khớp nếu pattern là thư mục /**
		else if (pattern.endsWith('/*')) {
			const basePath = pattern.slice(0, -2)
			if (pathname.startsWith(basePath)) return rule
		}

		// So khớp tương đối như bản cũ
		else {
			if (pathname.startsWith(pattern)) {
				const relative = pathname.slice(pattern.length)
				if (!relative.includes('/') || relative.endsWith('/')) return rule
			}
		}
	}

	return null
}

/**
 * @param {Cache} cache
 * @param {Request} request
 */
async function saveCacheMetadata(cache, request) {
	const metadata = { timestamp: Date.now() }
	const metadataRequest = new Request(`${request.url}-metadata`)
	await cache.put(metadataRequest, new Response(JSON.stringify(metadata)))
}

/**
 * @param {Cache} cache
 * @param {Request} request
 */
async function getCacheMetadata(cache, request) {
	const metadataRequest = new Request(`${request.url}-metadata`)
	const metadataResponse = await cache.match(metadataRequest)
	if (!metadataResponse) return null

	return JSON.parse(await metadataResponse.text())
}

/**
 * @param {Cache} cache
 * @param {Request} request
 */
async function removeIfExpired(cache, request) {
	const metadata = await getCacheMetadata(cache, request)
	if (!metadata) return false

	const isExpired = Date.now() - metadata.timestamp > CACHE_EXPIRATION
	if (isExpired) {
		await Promise.all([cache.delete(request), cache.delete(new Request(`${request.url}-metadata`))])
		return true
	}
	return false
}

// 2/2/2026: Thêm listener
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// Khi worker được install, xóa cache có tên hoặc version cũ
// 2/2/2026: Sửa 'install' thành 'activate'
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.map((key) => {
						if (key !== getFullCacheName()) {
							LOG && console.log(`--> [CacheManager.worker]: Deleting old cache ${key}`)
							return caches.delete(key)
						}
					}),
				),
			)
			.then(() => self.skipWaiting()),
	)
})

// Lắng nghe event xóa cache từ manager
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'CLEAR_CACHE') {
		caches
			.keys()
			.then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
			.then(() => {
				LOG && console.log('--> [CacheManager.worker]: Cache cleared on request')
				event.source.postMessage({ status: 'CACHE_CLEARED' })
			})
	}
})

// Khi fetch, kiểm tra và lấy từ cache, nếu cache hết hạn, cập nhật dưới nền
self.addEventListener('fetch', (event) => {
	if (CACHE_EXPIRATION < 1) return

	const requestUrl = new URL(event.request.url)
	const matchingRule = getMatchingRule(requestUrl)

	if (!matchingRule) return

	const cacheRequest = getCacheRequest(event.request, matchingRule.ignoreParam)

	event.respondWith(
		(async () => {
			const cache = await caches.open(getFullCacheName())
			const cachedResponse = await cache.match(cacheRequest)
			const isExpired = cachedResponse ? await removeIfExpired(cache, cacheRequest) : false

			if (cachedResponse) {
				LOG && console.log(`--> [CacheManager.worker]: Using cache for ${cacheRequest.url}`)
				if (isExpired) updateCacheInBackground(cacheRequest, cache)
				return cachedResponse
			}

			try {
				LOG && console.log(`--> [CacheManager.worker]: Fetching ${event.request.url} and caching`)
				const networkResponse = await fetch(event.request)

				if (!networkResponse.ok && networkResponse.type !== 'opaque')
					throw new Error('--> [CacheManager.worker]: Network response not ok')

				await cache.put(cacheRequest, networkResponse.clone())
				await saveCacheMetadata(cache, cacheRequest)
				return networkResponse
			} catch (error) {
				LOG && console.error(`--> [CacheManager.worker]: Fetch failed and no cache available: ${event.request.url}`)
				return new Response('--> [CacheManager.worker]: Network error and no cache available', {
					status: 503,
					statusText: 'Service Unavailable',
				})
			}
		})(),
	)
})

/**
 * Tạo Request mới từ cache key
 */
function getCacheRequest(request, ignoreParam = false) {
	const cacheKey = createCacheKey(request, ignoreParam)

	// Lấy các trường hợp an toàn để clone
	const safeInit = {
		method: request.method,
		headers: request.headers,
		credentials: request.credentials,
		cache: request.cache,
		redirect: request.redirect,
		referrer: request.referrer,
		referrerPolicy: request.referrerPolicy,
		integrity: request.integrity,
		// KHÔNG được set mode nếu là 'navigate'
		// mode: request.mode, ← bỏ dòng này!
	}

	return new Request(cacheKey, safeInit)
}

/**
 * Tạo cache key phù hợp cho request
 * @param {Request} request
 * @param {boolean} ignoreParam
 */
function createCacheKey(request, ignoreParam = false) {
	const url = new URL(request.url)
	return ignoreParam ? `${url.origin}${url.pathname}` : url.href
}

/**
 * Cập nhật cache trong nền khi cache đã cũ
 * @param {Request} request
 * @param {Cache} cache
 */
async function updateCacheInBackground(request, cache) {
	try {
		const networkResponse = await fetch(request)
		if (!networkResponse.ok && networkResponse.type !== 'opaque')
			throw new Error('--> [CacheManager.worker]: Network response not ok')

		await cache.put(request, networkResponse.clone())
		await saveCacheMetadata(cache, request)
		LOG && console.log(`--> [CacheManager.worker]: Cache updated for ${request.url}`)
	} catch (error) {
		LOG && console.warn(`--> [CacheManager.worker]: Background update failed for ${request.url}`, error)
	}
}
