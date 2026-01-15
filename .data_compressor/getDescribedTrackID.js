import fs from 'fs/promises';
import path from 'path';

/**
 * @param {string} rootDir
 * @returns {Promise<number[]>}
 */
export default async function getDescribedTrackID(rootDir) {
	const result = [];

	async function walk(dir) {
		const entries = await fs.readdir(dir, { withFileTypes: true });

		const subDirs = entries.filter((e) => e.isDirectory());

		// nếu không có thư mục con → đây là thư mục lá
		if (subDirs.length === 0) {
			const name = path.basename(dir);
			const num = Number.parseInt(name, 10);

			if (Number.isInteger(num)) {
				result.push(num);
			}
			return;
		}

		// còn thư mục con → duyệt tiếp
		for (const sub of subDirs) {
			await walk(path.join(dir, sub.name));
		}
	}

	await walk(rootDir);

	// sort theo độ lớn số
	return result.sort((a, b) => a - b);
}
