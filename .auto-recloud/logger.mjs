import fs from 'fs'
import path from 'path'

/**
 * @param {string} audioFile
 */
export function createLogger(audioFile) {
	const baseName = path.basename(audioFile, path.extname(audioFile))
	const reportDir = path.join(path.dirname(audioFile), 'report')
	fs.mkdirSync(reportDir, { recursive: true })

	const logFile = path.join(reportDir, `${baseName}.log.txt`)
	const stream = fs.createWriteStream(logFile, { flags: 'a' })

	let lastProgress = null

	function log(message) {
		const time = new Date().toISOString()
		stream.write(`[${time}] ${message}\n`)
	}

	function logProgress(prefix, percent) {
		if (percent === lastProgress) return
		lastProgress = percent
		log(`${prefix}: ${percent}%`)
	}

	function close() {
		stream.end()
	}

	return { log, logProgress, close, logFile }
}
