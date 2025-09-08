const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5500;
const ROOT_DIR = path.resolve(__dirname, '../'); // Hoặc thư mục chứa static

const MIME_TYPES = {
	'.html': 'text/html',
	'.css': 'text/css',
	'.js': 'text/javascript',
	'.mjs': 'text/javascript',
	'.json': 'application/json',
	'.csv': 'text/csv',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.txt': 'text/plain',
};

const server = http.createServer(async (req, res) => {
	try {
		const decodedUrl = decodeURIComponent(req.url.split('?')[0]);
		let filePath = path.join(ROOT_DIR, decodedUrl);

		// Bảo vệ không truy cập ra ngoài thư mục gốc
		if (!filePath.startsWith(ROOT_DIR)) {
			res.writeHead(403);
			return res.end('Access denied');
		}

		let stats;

		try {
			stats = await fs.promises.stat(filePath);
		} catch (err) {
			res.writeHead(404);
			return res.end('Not found');
		}

		// Nếu là thư mục thì tìm file index.html
		if (stats.isDirectory()) {
			filePath = path.join(filePath, 'index.html');
			try {
				stats = await fs.promises.stat(filePath);
			} catch {
				res.writeHead(404);
				return res.end('Directory index not found');
			}
		}

		// Nếu là file, gửi file về client
		if (stats.isFile()) {
			const ext = path.extname(filePath).toLowerCase();
			const contentType = MIME_TYPES[ext] || 'application/octet-stream';

			// **Thêm header CORS nếu request nằm trong thư mục .dev**
			const relativePath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/'); // chuẩn hóa đường dẫn
			const enableCORS = relativePath.startsWith('.dev/') || relativePath.startsWith('.data_compressor');

			const headers = { 'Content-Type': contentType };
			if (enableCORS) {
				headers['Access-Control-Allow-Origin'] = '*'; // hoặc đặt domain cụ thể nếu muốn giới hạn
				// Nếu cần hỗ trợ preflight:
				headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
				headers['Access-Control-Allow-Headers'] = 'Content-Type';
			}

			// Nếu là preflight OPTIONS request, trả về ngay
			if (req.method === 'OPTIONS' && enableCORS) {
				res.writeHead(204, headers);
				return res.end();
			}

			res.writeHead(200, headers);
			fs.createReadStream(filePath).pipe(res);
		} else {
			res.writeHead(404);
			res.end('Not found');
		}
	} catch (err) {
		console.error('Internal server error:', err);
		res.writeHead(500);
		res.end('Internal server error');
	}
});

server.listen(PORT, () => {
	console.log(`Serving at http://127.0.0.1:${PORT}`);
});
