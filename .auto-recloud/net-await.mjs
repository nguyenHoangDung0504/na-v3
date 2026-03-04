/**
 * @typedef {import('puppeteer').Page} Page
 * @typedef {import('./logger.mjs').Logger} Logger
 */

/**
 * Wait for upload task_id response.
 *
 * @param {Page} page
 * @param {number} [timeout=300000]
 * @returns {Promise<string>}
 */
export async function waitForUploadTaskID(page, timeout = 5 * 60 * 1000) {
	const res = await page.waitForResponse(
		async (r) => {
			if (!r.url().endsWith('/subtitles/language/recognition')) return false
			try {
				const json = await r.json()
				return Boolean(json?.data?.task_id)
			} catch {
				return false
			}
		},
		{ timeout },
	)

	const json = await res.json()
	const uploadTaskId = json.data.task_id
	console.log(`uploadTaskID:`, uploadTaskId)

	return uploadTaskId
}

/**
 * Wait until upload progress reaches 100%.
 *
 * @param {Page} page
 * @param {string} taskId
 * @param {Logger} logger
 * @param {number} [timeout=1200000]
 * @returns {Promise<void>}
 */
export async function waitForUploadDone(page, taskId, logger, timeout = 20 * 60 * 1000) {
	const start = Date.now()

	await page.waitForResponse(
		async (r) => {
			if (!r.url().endsWith(`/subtitles/language/recognition/${taskId}`)) return false
			try {
				const json = await r.json()
				const progress = json?.data?.progress
				if (typeof progress === 'number') {
					logger.logProgress('Upload', progress)
				}
				return progress === 100
			} catch {
				return false
			}
		},
		{ timeout },
	)

	const duration = ((Date.now() - start) / 1000).toFixed(2)
	logger.log(`Upload completed in ${duration}s`)
}

/**
 * Wait for generate task_id.
 *
 * @param {Page} page
 * @param {number} [timeout=300000]
 * @returns {Promise<string>}
 */
export async function waitForGenerateTaskID(page, timeout = 5 * 60 * 1000) {
	const res = await page.waitForResponse(
		async (r) => {
			if (!r.url().endsWith('/subtitles/recognition/v2')) return false
			try {
				const json = await r.json()
				return Boolean(json?.data?.task_id)
			} catch {
				return false
			}
		},
		{ timeout },
	)

	const json = await res.json()
	const genTaskID = json.data.task_id
	console.log(`genTaskID:`, genTaskID)

	return genTaskID
}

/**
 * Wait until subtitles array is available.
 *
 * @param {Page} page
 * @param {string} taskId
 * @param {Logger} logger
 * @param {number} [timeout=1800000]
 * @returns {Promise<void>}
 */
export async function waitForSubtitles(page, taskId, logger, timeout = 30 * 60 * 1000) {
	const start = Date.now()

	await page.waitForResponse(
		async (r) => {
			if (!r.url().endsWith(`/subtitles/recognition/v2/${taskId}`)) return false
			try {
				const json = await r.json()
				const data = json?.data

				if (typeof data?.progress === 'number') {
					logger.logProgress('Processing', data.progress)
				}

				return Array.isArray(data?.subtitles)
			} catch {
				return false
			}
		},
		{ timeout },
	)

	const duration = ((Date.now() - start) / 1000).toFixed(2)
	logger.log(`Processing completed in ${duration}s`)
}
