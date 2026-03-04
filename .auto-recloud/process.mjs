// @ts-check

import path from 'path'
import fs from 'fs'
import puppeteer from 'puppeteer'

import { createLogger } from './logger.mjs'
import { getResult, triggerGenerate } from './evals.mjs'
import { waitForGenerateTaskID, waitForSubtitles, waitForUploadDone, waitForUploadTaskID } from './net-await.mjs'
import { blockTrackingScript } from './net-block.mjs'

/** @type {import('puppeteer').Browser | null} */
let sharedBrowser = null

async function getBrowser() {
	if (!sharedBrowser || !sharedBrowser.connected) {
		sharedBrowser = await puppeteer.launch({
			headless: true,
			defaultViewport: null,
		})
	}

	return sharedBrowser
}

/**
 * Process one audio file.
 *
 * @param {string} audioFile Absolute path
 * @returns {Promise<void>}
 */
export async function processAudio(audioFile) {
	const baseName = path.basename(audioFile, path.extname(audioFile))
	const outDir = path.join(path.dirname(audioFile), 'vtt')
	const output1 = path.join(outDir, `${baseName}.txt`)
	const output2 = path.join(outDir, `${baseName}.raw.txt`)

	if (fs.existsSync(output1) && fs.existsSync(output2)) {
		return
	}

	const logger = createLogger(audioFile)

	for (let attempt = 1; attempt <= 2; attempt++) {
		/** @type {import('puppeteer').BrowserContext | null} */
		let context = null

		try {
			logger.log(`Start processing (attempt ${attempt})`)

			const browser = await getBrowser()
			context = await browser.createBrowserContext()
			const page = await context.newPage()

			await blockTrackingScript(page)
			await page.goto('https://reccloud.com/ai-subtitle?v=product', { waitUntil: 'load' })

			const [fileChooser] = await Promise.all([
				page.waitForFileChooser(),
				page.click('[data-v-f9a0b884].gradient-button-auto-theme'),
			])

			await fileChooser.accept([audioFile])
			logger.log('File selected')

			const uploadTaskID = await waitForUploadTaskID(page)
			await waitForUploadDone(page, uploadTaskID, logger)

			await triggerGenerate(page)

			const genTaskID = await waitForGenerateTaskID(page)
			await waitForSubtitles(page, genTaskID, logger)

			const { origin, translation } = await getResult(page)

			fs.mkdirSync(outDir, { recursive: true })
			fs.writeFileSync(output2, origin, 'utf-8')
			fs.writeFileSync(output1, translation, 'utf-8')

			logger.log('SUCCESS')
			logger.close()
			return
		} catch (err) {
			logger.log(`ERROR: ${err instanceof Error ? err.message : String(err)}`)

			if (attempt === 2) {
				logger.log('FAILED after retry')
				logger.close()
			}
		} finally {
			if (context) await context.close()
		}
	}
}
