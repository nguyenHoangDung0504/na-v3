// @ts-check

import path from 'path'
import fs from 'fs'

import { processAudio } from './process.mjs'

const targetDir = process.argv[2]
if (!targetDir) {
	console.log(`
Usage:
  node index.js <relative-path-to-media-folder>

Example:
  node index.js ./media
`)
	process.exit(1)
}

const MEDIA_DIR = path.resolve(process.cwd(), targetDir)
if (!fs.existsSync(MEDIA_DIR) || !fs.statSync(MEDIA_DIR).isDirectory()) {
	console.error(`Invalid directory: ${MEDIA_DIR}`)
	process.exit(1)
}
console.log(`Scanning directory: ${MEDIA_DIR}`)

const CONCURRENCY = 2

/**
 * Supported media extensions (audio + video).
 * @type {Set<string>}
 */
const MEDIA_EXTENSIONS = new Set([
	'.mp3',
	'.wav',
	'.m4a',
	'.flac',
	'.aac',
	'.ogg',
	'.mp4',
	'.mov',
	'.mkv',
	'.webm',
	'.avi',
])

/**
 * Get media files from directory.
 * @param {string} dir
 * @returns {string[]}
 */
function getMediaFiles(dir) {
	return fs
		.readdirSync(dir)
		.filter((f) => MEDIA_EXTENSIONS.has(path.extname(f).toLowerCase()))
		.map((f) => path.join(dir, f))
}

const mediaFiles = getMediaFiles(MEDIA_DIR)
if (mediaFiles.length === 0) {
	console.log('No supported media files found.')
	process.exit(0)
}
console.log(`Found ${mediaFiles.length} media files.`)
const queue = [...mediaFiles]

await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)))
console.log('All done.')
process.exit(0)

/**
 * Worker loop.
 * @param {number} id
 * @returns {Promise<void>}
 */
async function worker(id) {
	while (queue.length) {
		const file = queue.shift()
		if (!file) break

		console.log(`Worker ${id} processing: ${file}`)
		await processAudio(file)
	}
	console.log(`Worker ${id} finished.`)
}
