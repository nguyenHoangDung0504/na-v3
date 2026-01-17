import { data } from './.data_compressor/storage/index.js';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';

const id = parseInt(process.argv[2], 10);
if (isNaN(id)) {
	console.error('Nhập ID hợp lệ, ví dụ: node .gen-vtt.js 1125');
	process.exit(1);
}

const rootDir = path.resolve(`./@descriptions/vtts/${id}/`);

const targetInfo = data.find((rec) => String(rec[0]) === String(id));
if (!targetInfo) {
	console.error(`Không tìm thấy record với ID = ${id}`);
	process.exit(1);
}

const vttList = String(targetInfo[9]).split(',');
const vttCount = vttList.length;

console.log('VTT count:', vttCount);

// đảm bảo thư mục tồn tại
fs.mkdirSync(rootDir, { recursive: true });

for (let i = 0; i < vttCount; i++) {
	const filePath = path.join(rootDir, `${i}.txt`);
	if (i === 0) exec(`code --reuse-window "${filePath}"`);

	// LỚP BẢO HIỂM
	if (fs.existsSync(filePath)) continue;
	fs.writeFileSync(filePath, '', {
		encoding: 'utf8',
		flag: 'wx', // extra safety: fail if file exists
	});
}
