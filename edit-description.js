const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Lấy ID từ tham số dòng lệnh
const id = parseInt(process.argv[2], 10);
if (isNaN(id)) {
	console.error('Vui lòng nhập ID hợp lệ, ví dụ: node edit-description.js 1125');
	process.exit(1);
}

const group = Math.trunc(id / 1000);
const rootDir = path.resolve(__dirname, './@descriptions/storage');
const dirPath = path.join(rootDir, String(group), String(id));
const filePath = path.join(dirPath, 'vi.txt');

// Nếu chưa có file, tạo thư mục và file rỗng
if (!fs.existsSync(filePath)) {
	fs.mkdirSync(dirPath, { recursive: true });
	fs.writeFileSync(filePath, getTemplate(), 'utf8');
	console.log('Đã tạo:', filePath);
} else {
	console.log('Đã tồn tại:', filePath);
}

exec(`code --reuse-window "${filePath}"`);

function getTemplate() {
	return `
		- Content_Des
		
		- Character_Des
		
		- Track_Des

	`
		.split('\n')
		.filter(Boolean)
		.map((l) => l.trim())
		.join('\n');
}
