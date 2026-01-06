const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Lấy ID từ tham số dòng lệnh
const id = parseInt(process.argv[2], 10);
if (isNaN(id)) {
	console.error('Nhập ID hợp lệ, ví dụ: node .edit-description.js 1125');
	process.exit(1);
}

const group = simplifyNumber(id);
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

function simplifyNumber(n) {
	if (n < 10000) return 10000;

	const str = String(n);
	const length = str.length;

	// Quy tắc: giữ 1 chữ số đầu nếu < 100000
	// Giữ 2 chữ số đầu nếu < 1_000_000
	// Giữ 3 chữ số đầu nếu lớn hơn
	let keep;
	if (length <= 5) keep = 1;
	else if (length === 6) keep = 2;
	else keep = 3; // phòng xa

	const head = str.slice(0, keep);
	const zeros = '0'.repeat(length - keep);
	return parseInt(head + zeros);
}

function getTemplate() {
	return `- Content_Des
	
- Character_Des
	<div class="char-box">
		<div class="l"></div>
		<div class="r"></div>
	</div>
	
- Track_Des
	
	`;
}
