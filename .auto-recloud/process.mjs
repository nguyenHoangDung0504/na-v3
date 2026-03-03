// @ts-check

import path from 'path'
import fs from 'fs'
import puppeteer from 'puppeteer'

import { getResult, triggerGenerate } from './evals.mjs'
import { waitForGenerateTaskID, waitForSubtitles, waitForUploadDone, waitForUploadTaskID } from './net-await.mjs'
import { blockTrackingScript } from './net-block.mjs'

/**
 * Process one audio file.
 *
 * @param {string} audioFile Absolute path
 * @returns {Promise<void>}
 */
export async function processAudio(audioFile) {
	console.log(`Start processing: ${audioFile}`)

	/** @type {import('puppeteer').Browser | null} */
	let browser = null

	try {
		browser = await puppeteer.launch()
		const [page] = await browser.pages()

		await blockTrackingScript(page)
		await page.goto('https://reccloud.com/ai-subtitle?v=product', { waitUntil: 'load' })

		// Upload
		const [fileChooser] = await Promise.all([
			page.waitForFileChooser(),
			page.click('[data-v-f9a0b884].gradient-button-auto-theme'),
		])
		await fileChooser.accept([audioFile])
		console.log('File selected. Uploading...')

		// Wait upload
		const uploadTaskID = await waitForUploadTaskID(page)
		await waitForUploadDone(page, uploadTaskID)

		// Wait generate
		await triggerGenerate(page)
		const genTaskID = await waitForGenerateTaskID(page)
		await waitForSubtitles(page, genTaskID)

		// Write
		const { origin, translation } = await getResult(page)
		const baseName = path.basename(audioFile, path.extname(audioFile))
		const outDir = path.join(path.dirname(audioFile), 'vtt')

		fs.mkdirSync(outDir, { recursive: true })
		fs.writeFileSync(path.join(outDir, `${baseName}.raw.txt`), origin, 'utf-8')
		fs.writeFileSync(path.join(outDir, `${baseName}.txt`), translation, 'utf-8')

		console.log(`Done: ${audioFile}`)
	} catch (err) {
		console.error(`Error processing ${audioFile}:`, err)
	} finally {
		if (browser) await browser.close()
	}
}
