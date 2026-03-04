import fs from 'fs'
import path from 'path'

import { fileURLToPath } from 'url'
import { pipeline } from 'stream/promises'

import { data } from './.data_compressor/storage/index.js'
import { simplifyNumber } from './@descriptions/utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ================= HELP =================

function showHelp() {
	console.log(`
Usage:
  node .download-audio.mjs <code> <indexes>

Indexes:
  all        Download all tracks
  0,3,4      Specific indexes (comma-separated)
  1-4        Range (inclusive)
  0,2,5-8    Mixed

Examples:
  node .download-audio.mjs 111111 all
  node .download-audio.mjs 111111 0,3,4
  node .download-audio.mjs 111111 1-4
  node .download-audio.mjs 111111 0,2,5-8
`)
}

// ================= CLI =================

const args = process.argv.slice(2)

if (!args.length || args.includes('-h')) {
	showHelp()
	process.exit(0)
}

const [inputCode, indexArg] = args

if (!inputCode || !indexArg) {
	console.error('Missing arguments. Use -h for help.')
	process.exit(1)
}

/**
 * Parse index string: supports "all", "0,3,4", "1-4", "0,2,5-8"
 * "all" returns null (resolve later when we know total count)
 *
 * @param {string} raw
 * @param {number} total
 * @returns {number[]}
 */
function parseIndexes(raw, total) {
	if (raw.trim() === 'all') {
		return Array.from({ length: total }, (_, i) => i)
	}

	/** @type {number[]} */
	const result = []

	for (const part of raw.split(',')) {
		const range = part.trim().match(/^(\d+)-(\d+)$/)
		if (range) {
			const from = parseInt(range[1], 10)
			const to = parseInt(range[2], 10)
			for (let i = from; i <= to; i++) result.push(i)
		} else {
			const n = parseInt(part.trim(), 10)
			if (!isNaN(n)) result.push(n)
		}
	}

	return [...new Set(result)].sort((a, b) => a - b)
}

// ================= ROOT PATH =================

const rootDir = path.resolve(__dirname, './@descriptions/storage')
const group = simplifyNumber(Number(inputCode))
const dirPath = path.join(rootDir, String(group), String(inputCode))

// ================= MAIN =================

main()

async function main() {
	const row = data.find((r) => String(r[0]) === String(inputCode))
	if (!row) {
		console.error('Không tìm thấy code trong data')
		process.exit(1)
	}

	const apiCodeRaw = row[1]
	if (!apiCodeRaw || apiCodeRaw.length <= 2) {
		console.error('Code API không hợp lệ')
		process.exit(1)
	}

	const apiCode = apiCodeRaw.slice(2)

	const rawUrls = row[9]
	if (!rawUrls) {
		console.error('Không có urls ở index 9')
		process.exit(1)
	}

	const streamUrls = rawUrls.split(',').map((s) => s.trim())

	const selectedIndexes = parseIndexes(indexArg, streamUrls.length)
	if (!selectedIndexes.length) {
		console.error('Index không hợp lệ. Dùng -h để xem hướng dẫn.')
		process.exit(1)
	}

	const targets = selectedIndexes.map((i) => ({ index: i, streamUrl: streamUrls[i] })).filter((x) => x.streamUrl)

	if (!targets.length) {
		console.error('Không có url hợp lệ theo index đã chọn.')
		process.exit(1)
	}

	console.log('Target indexes:', targets.map((t) => t.index).join(', '))

	const manifest = await getManifestJSON(apiCode)
	if (!manifest) {
		console.error('Không lấy được manifest')
		process.exit(1)
	}

	const STORAGE = []
	manifest.forEach((children) => {
		children['@folder'] = '@ROOT'
		if (isFolder(children)) return traversal(children, STORAGE)
		STORAGE.push(format(children))
	})

	const downloadTasks = []
	for (const target of targets) {
		const match = STORAGE.find((item) => [item.mediaStreamUrl, item.streamLowQualityUrl].includes(target.streamUrl))
		if (!match?.mediaDownloadUrl) continue
		downloadTasks.push({ index: target.index, url: match.mediaDownloadUrl })
	}

	if (!downloadTasks.length) {
		console.error('Không match được mediaDownloadUrl')
		process.exit(1)
	}

	fs.mkdirSync(dirPath, { recursive: true })
	await runPool(downloadTasks, 3)

	console.log('Done.')
}

// ================= CONCURRENCY POOL =================

async function runPool(tasks, limit) {
	let cursor = 0
	await Promise.all(
		Array.from({ length: limit }, async () => {
			while (true) {
				const taskIndex = cursor++
				if (taskIndex >= tasks.length) break
				await downloadWithRetry(tasks[taskIndex])
			}
		}),
	)
}

// ================= DOWNLOAD =================

async function downloadWithRetry(task, retries = 1) {
	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			await downloadStream(task)
			return
		} catch (err) {
			console.log(`Retry ${attempt}/${retries} for [${task.index}]`)
			if (attempt === retries) {
				console.error(`✖ [${task.index}] failed permanently`)
			}
		}
	}
}

async function downloadStream({ index, url }) {
	const ext = getExtension(url)
	const filePath = path.join(dirPath, `${index}${ext}`)

	if (fs.existsSync(filePath)) {
		console.log(`↷ [${index}] skip (exists)\n\tAt: ${filePath}`)
		return
	}

	console.log(`↓ [${index}] start`)
	const res = await fetch(url)
	if (!res.ok || !res.body) throw new Error('Network error')
	await pipeline(res.body, fs.createWriteStream(filePath))
	console.log(`✔ [${index}] done\n\tAt: ${filePath}`)
}

// ================= HELPERS =================

function isFolder(json) {
	return json.type === 'folder' && json.children?.length > 0
}

function format(children) {
	delete children.hash
	delete children.work
	delete children.duration
	delete children.size
	delete children.workTitle
	return children
}

function traversal(folder, storage) {
	folder.children.forEach((children) => {
		children['@folder'] = `${(folder['@folder'] ??= '')} / ${folder.title}`
		if (isFolder(children)) return traversal(children, storage)
		storage.push(format(children))
	})
}

async function getManifestJSON(code, version = 2) {
	return await (await fetch(`https://api.asmr-200.com/api/tracks/${code}?v=${version}`)).json()
}

function getExtension(url) {
	const clean = url.split('?')[0]
	return path.extname(clean) || '.bin'
}
