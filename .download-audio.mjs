import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { pipeline } from 'stream/promises'
import { data } from './.data_compressor/storage/index.js'
import { simplifyNumber } from './@descriptions/utils.js'

// ================= ESM dirname =================

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ================= CLI =================

const inputCode = process.argv[2]
const indexArg = process.argv[3]

if (!inputCode || !indexArg) {
	console.error('Ví dụ: node .download-audio.mjs 111111 0,3,4')
	process.exit(1)
}

const selectedIndexes = indexArg
	.split(',')
	.map((n) => parseInt(n.trim(), 10))
	.filter((n) => !isNaN(n))

if (!selectedIndexes.length) {
	console.error('Index không hợp lệ.')
	process.exit(1)
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

	// 👉 Lấy API code từ index 1 và bỏ 2 ký tự đầu
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

	const targets = selectedIndexes
		.map((i) => ({
			index: i,
			streamUrl: streamUrls[i],
		}))
		.filter((x) => x.streamUrl)

	if (!targets.length) {
		console.error('Không có url hợp lệ theo index')
		process.exit(1)
	}

	console.log('Target index:', targets.map((t) => t.index).join(','))

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

		downloadTasks.push({
			index: target.index,
			url: match.mediaDownloadUrl,
		})
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

	const workers = Array.from({ length: limit }, async () => {
		while (true) {
			const taskIndex = cursor++
			if (taskIndex >= tasks.length) break
			await downloadWithRetry(tasks[taskIndex])
		}
	})

	await Promise.all(workers)
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

	// Skip nếu tồn tại
	if (fs.existsSync(filePath)) {
		console.log(`↷ [${index}] skip (exists)`)
		console.log('\tAt:', filePath)
		return
	}

	console.log(`↓ [${index}] start`)

	const res = await fetch(url)

	if (!res.ok || !res.body) {
		throw new Error('Network error')
	}

	await pipeline(res.body, fs.createWriteStream(filePath))

	console.log(`✔ [${index}] done`)
	console.log('\tAt:', filePath)
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
	const ext = path.extname(clean)
	return ext || '.bin'
}
