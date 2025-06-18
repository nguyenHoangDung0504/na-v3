const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5500;
const ROOT_DIR = path.resolve(__dirname); // Hoặc thư mục chứa static

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
			res.writeHead(200, { 'Content-Type': contentType });
			fs.createReadStream(filePath).pipe(res);
			// console.log('Serving:', filePath);
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
