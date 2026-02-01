import fs from 'fs'
import path from 'path'

/**
 * Duyệt qua toàn bộ cấu trúc @descriptions/storage/
 * @returns {{ describedIDs: number[], vttIDs: number[] }}
 */
export function scanStorage() {
	const storageRoot = path.resolve('./@descriptions/storage/')

	const describedIDs = []
	const vttIDs = []

	// Kiểm tra thư mục storage có tồn tại không
	if (!fs.existsSync(storageRoot)) {
		console.warn('Thư mục storage không tồn tại:', storageRoot)
		return { describedIDs, vttIDs }
	}

	// Duyệt qua các thư mục group (10000, 20000, ...)
	const groupDirs = fs.readdirSync(storageRoot, { withFileTypes: true }).filter((dirent) => dirent.isDirectory())

	for (const groupDir of groupDirs) {
		const groupPath = path.join(storageRoot, groupDir.name)

		// Duyệt qua các thư mục ID trong group
		const idDirs = fs.readdirSync(groupPath, { withFileTypes: true }).filter((dirent) => dirent.isDirectory())

		for (const idDir of idDirs) {
			const idPath = path.join(groupPath, idDir.name)
			const id = parseInt(idDir.name, 10)

			// Bỏ qua nếu tên folder không phải số hợp lệ
			if (isNaN(id)) continue

			// Kiểm tra file vi.txt
			const viTxtPath = path.join(idPath, 'vi.txt')
			if (fs.existsSync(viTxtPath)) {
				describedIDs.push(id)
			}

			// Kiểm tra thư mục vtt/
			const vttDirPath = path.join(idPath, 'vtt')
			if (fs.existsSync(vttDirPath) && fs.statSync(vttDirPath).isDirectory()) {
				// Kiểm tra có file nào trong vtt/ không
				const vttFiles = fs.readdirSync(vttDirPath)
				if (vttFiles.length > 0) vttIDs.push(id)
			}
		}
	}

	return { describedIDs, vttIDs }
}

/**
 * @deprecated
 * @param {string} rootDir
 * @returns {Promise<number[]>}
 */
export async function getDescribedTrackID(rootDir) {
	const fs = (await import('fs/promises')).default
	const result = []

	async function walk(dir) {
		const entries = await fs.readdir(dir, { withFileTypes: true })

		const subDirs = entries.filter((e) => e.isDirectory())

		// nếu không có thư mục con → đây là thư mục lá
		if (subDirs.length === 0) {
			const name = path.basename(dir)
			const num = Number.parseInt(name, 10)

			if (Number.isInteger(num)) {
				result.push(num)
			}
			return
		}

		// còn thư mục con → duyệt tiếp
		for (const sub of subDirs) {
			await walk(path.join(dir, sub.name))
		}
	}

	await walk(rootDir)

	// sort theo độ lớn số
	return result.sort((a, b) => a - b)
}
