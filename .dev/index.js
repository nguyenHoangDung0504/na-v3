import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = 5500
const ROOT_DIR = path.resolve(__dirname, '../')

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
}

const server = http.createServer(async (req, res) => {
	try {
		const decodedUrl = decodeURIComponent(req.url.split('?')[0])
		if (usePatchAPI(req, res, decodedUrl)) return
		if (useManifestAPI(req, res, decodedUrl)) return

		// Static host
		let filePath = path.join(ROOT_DIR, decodedUrl)

		// Bảo vệ không truy cập ra ngoài thư mục gốc
		if (!filePath.startsWith(ROOT_DIR)) {
			res.writeHead(403)
			return res.end('Access denied')
		}

		let stats

		try {
			stats = await fs.promises.stat(filePath)
		} catch (err) {
			res.writeHead(404)
			return res.end('Not found')
		}

		// Nếu là thư mục thì tìm file index.html
		if (stats.isDirectory()) {
			filePath = path.join(filePath, 'index.html')
			try {
				stats = await fs.promises.stat(filePath)
			} catch {
				res.writeHead(404)
				return res.end('Directory index not found')
			}
		}

		// Nếu là file, gửi file về client
		if (stats.isFile()) {
			const ext = path.extname(filePath).toLowerCase()
			const contentType = MIME_TYPES[ext] || 'application/octet-stream'

			// **Thêm header CORS nếu request nằm trong thư mục .dev**
			const relativePath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/') // chuẩn hóa đường dẫn
			const enableCORS = relativePath.startsWith('.dev/') || relativePath.startsWith('.data_compressor')

			const headers = { 'Content-Type': contentType }
			if (enableCORS) {
				headers['Access-Control-Allow-Origin'] = '*' // hoặc đặt domain cụ thể nếu muốn giới hạn
				// Nếu cần hỗ trợ preflight:
				headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
				headers['Access-Control-Allow-Headers'] = 'Content-Type'
			}

			// Nếu là preflight OPTIONS request, trả về ngay
			if (req.method === 'OPTIONS' && enableCORS) {
				res.writeHead(204, headers)
				return res.end()
			}

			res.writeHead(200, headers)
			fs.createReadStream(filePath).pipe(res)
		} else {
			res.writeHead(404)
			res.end('Not found')
		}
	} catch (err) {
		console.error('Internal server error:', err)
		res.writeHead(500)
		res.end('Internal server error')
	}
})

server.listen(PORT, () => console.log(`Serving at http://127.0.0.1:${PORT}`))
const DATA_PATH = path.resolve(__dirname, '../.data_compressor/storage/data.csv')

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {string} decodedURL
 */
function useManifestAPI(req, res, decodedURL) {
	if (!decodedURL.startsWith('/api/manifest') || req.method !== 'GET') return false

	const url = new URL(req.url, 'http://localhost')
	const code = url.searchParams.get('code')
	const version = url.searchParams.get('v') ?? 2

	if (!code) {
		res.writeHead(400)
		res.end('Missing code')
		return true
	}

	const apiURL = `https://api.asmr-200.com/api/tracks/${code}?v=${version}`

	console.log('Proxy manifest:', apiURL)

	fetch(apiURL)
		.then((r) => r.text())
		.then((data) => {
			res.writeHead(200, {
				'Access-Control-Allow-Origin': '*',
				'Content-Type': 'application/json',
			})
			res.end(data)
		})
		.catch((err) => {
			console.error(err)
			res.writeHead(500)
			res.end('Proxy failed')
		})

	return true
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage }} res
 * @param {string} decodedURL
 */
function usePatchAPI(req, res, decodedURL) {
	if (decodedURL !== '/api/patch' || req.method !== 'POST') return false

	const MAX_BODY = 2 * 1024 * 1024 // 2MB
	let body = ''

	req.on('data', (chunk) => {
		body += chunk

		if (body.length > MAX_BODY) {
			res.writeHead(413, { 'Content-Type': 'text/plain' })
			res.end('Payload too large')
			req.destroy()
		}
	})

	req.on('end', async () => {
		console.log('Request:', req.method, req.url, req.headers.origin)
		try {
			const { code, thumbnail, images, audios } = JSON.parse(body)
			patchData({ code, thumbnail, images, audios })
			console.log('Patched:', code)

			res.writeHead(200, {
				'Access-Control-Allow-Origin': '*',
				'Content-Type': 'text/plain',
			})
			res.end('OK')
		} catch (err) {
			console.error(err)
			res.writeHead(500)
			res.end('Patch failed')
		}
	})

	return true
}

/**
 * @param {{ code: string, thumbnail: string, images: string, audios: string }} param0
 */
function patchData({ code, thumbnail, images, audios }) {
	const data = fs.readFileSync(DATA_PATH, 'utf8')
	const lines = data.split('\n')

	let start = -1

	for (let i = 0; i < lines.length; i++) {
		if (lines[i] === code + ':') {
			start = i
			break
		}
	}

	if (start === -1) {
		console.warn('Code not found:', code)
		return
	}

	const THUMBNAIL_LINE = start + 7
	const IMAGE_LINE = start + 8
	const AUDIO_LINE = start + 9

	if (thumbnail) lines[THUMBNAIL_LINE] = '\t' + thumbnail
	if (images) lines[IMAGE_LINE] = '\t' + images
	if (audios) lines[AUDIO_LINE] = '\t' + audios

	fs.writeFileSync(DATA_PATH, lines.join('\n'), 'utf8')
}
