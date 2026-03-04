// @ts-check

import fs from 'fs'
import path from 'path'

const targetDir = process.argv[2]
if (!targetDir) process.exit(1)

const MEDIA_DIR = path.isAbsolute(targetDir) ? targetDir : path.resolve(process.cwd(), targetDir)

/**
 * Supported extensions
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
 * @param {string} dir
 */
function cleanup(dir) {
	const files = fs.readdirSync(dir)

	for (const file of files) {
		const full = path.join(dir, file)
		const stat = fs.statSync(full)

		if (stat.isDirectory()) {
			if (file === 'report') {
				fs.rmSync(full, { recursive: true, force: true })
			} else {
				cleanup(full)
			}
			continue
		}

		// Nếu là media file
		if (MEDIA_EXTENSIONS.has(path.extname(file).toLowerCase())) {
			const baseName = path.basename(file, path.extname(file))
			const vttDir = path.join(dir, 'vtt')

			const output1 = path.join(vttDir, `${baseName}.txt`)
			const output2 = path.join(vttDir, `${baseName}.raw.txt`)

			// Nếu có đủ output -> xóa media
			if (fs.existsSync(output1) && fs.existsSync(output2)) {
				fs.unlinkSync(full)
			}
		}
	}
}

cleanup(MEDIA_DIR)
