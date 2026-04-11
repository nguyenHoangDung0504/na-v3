import fs from 'fs/promises'
import path from 'path'

const inputDirs = process.argv.slice(2)

if (!inputDirs.length) {
	console.error('Usage: node script.js <folder1> <folder2> ...')
	process.exit(1)
}

const AUDIO_EXT = new Set(['.mp3', '.wav', '.m4a'])

async function scan(dir, results) {
	let entries
	try {
		entries = await fs.readdir(dir, { withFileTypes: true })
	} catch {
		return
	}

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name)

		if (entry.isDirectory()) {
			await scan(fullPath, results)
		} else if (entry.isFile()) {
			const ext = path.extname(entry.name).toLowerCase()
			if (AUDIO_EXT.has(ext)) {
				results.push(fullPath)
			}
		}
	}
}

const results = []

for (const dir of inputDirs) {
	const resolved = path.resolve(process.cwd(), dir)
	await scan(resolved, results)
}

process.stdout.write(results.map((path) => `"${path}"`).join(' `\r\n'))
process.stdout.write('\n\n')
process.stdout.write(
	[...new Set(results.map((path) => `"${path.split('\\').slice(0, -1).join('\\')}"`))].join(' `\r\n'),
)
