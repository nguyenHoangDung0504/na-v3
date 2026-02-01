import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { fileURLToPath } from 'url'
import { simplifyNumber } from './@descriptions/utils.js'

// Thay thế __dirname trong ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Lấy ID từ tham số dòng lệnh
const id = parseInt(process.argv[2], 10)
if (isNaN(id)) {
	console.error('Nhập ID hợp lệ, ví dụ: node .edit-description.js 1125')
	process.exit(1)
}

const group = simplifyNumber(id)
const rootDir = path.resolve(__dirname, './@descriptions/storage')
const dirPath = path.join(rootDir, String(group), String(id))
const filePath = path.join(dirPath, 'vi.txt')

// Nếu chưa có file, tạo thư mục và file rỗng
if (!fs.existsSync(filePath)) {
	fs.mkdirSync(dirPath, { recursive: true })
	fs.writeFileSync(filePath, getTemplate(), 'utf8')
	console.log('Đã tạo:', filePath)
} else console.log('Đã tồn tại:', filePath)

exec(`code --reuse-window "${filePath}"`)

function getTemplate() {
	return `- Content_Des
	
- Character_Des
	<div class="char-box">
		<div class="l"></div>
		<div class="r"></div>
	</div>
	
- Track_Des
	
	`
}
