import { existsSync, readdirSync, writeFileSync, unlinkSync } from 'fs'
import { resolve, extname, join } from 'path'
import { execSync } from 'child_process'

// lấy arg (relative hoặc absolute đều được)
const inputArg = process.argv[2]

if (!inputArg) {
	console.error('Usage: node merge-audio.js <folder>')
	process.exit(1)
}

// resolve từ cwd
const dir = resolve(process.cwd(), inputArg)

if (!existsSync(dir)) {
	console.error('Folder not found:', dir)
	process.exit(1)
}

// đọc file audio
const files = readdirSync(dir)
	.filter((f) => /\.(mp3|m4a)$/i.test(f))
	.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

if (files.length === 0) {
	console.error('No audio files found')
	process.exit(1)
}

// detect format (assume đồng nhất)
const ext = extname(files[0]).toLowerCase()
const output = join(dir, `all${ext}`)
const listPath = join(dir, 'list.txt')

// tạo list.txt (relative path để ffmpeg hiểu đúng)
const listContent = files.map((f) => `file '${f}'`).join('\n')
writeFileSync(listPath, listContent)

try {
	console.log('Merging in:', dir)

	execSync(`ffmpeg -f concat -safe 0 -i "list.txt" -map 0:a -c copy "all${ext}"`, {
		stdio: 'inherit',
		cwd: dir,
	})

	console.log('Merge done:', output)

	// xóa file gốc
	for (const f of files) {
		unlinkSync(join(dir, f))
	}

	// xóa list.txt
	unlinkSync(listPath)

	console.log('Cleanup done')
} catch (err) {
	console.error('Error running ffmpeg')
	console.error(err.message)
}
