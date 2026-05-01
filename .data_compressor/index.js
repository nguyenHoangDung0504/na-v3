import { existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import { data } from './storage/index.js'
import { convertQuotes } from './utils.js'
import { scanStorage } from './getDescribedTrackID.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DIST_PATH = (function getDist() {
	const DIST_PATH = join(__dirname, '../@resources/databases/s1/')
	if (!existsSync(DIST_PATH)) throw new Error('Directory not found! Create before run')
	return DIST_PATH
})()

// ─── Base64 ID helpers ────────────────────────────────────────────────────────
// Bảng 64 ký tự: 0-9 A-Z a-z _ ~  (an toàn cho CSV và URL)
const B64_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_~'

/**
 * Encode một số nguyên dương (1-based) thành chuỗi base64 tùy chỉnh.
 * ID 1–63  → 1 ký tự   (tiết kiệm so với "1"–"63")
 * ID 64–4095 → 2 ký tự (tiết kiệm so với "64"–"4095")
 * @param {number} n
 * @returns {string}
 */
function toB64(n) {
	if (n <= 0) throw new RangeError('toB64: n must be >= 1')
	let result = ''
	do {
		result = B64_CHARS[n % 64] + result
		n = Math.floor(n / 64)
	} while (n > 0)
	return result
}
// ─────────────────────────────────────────────────────────────────────────────

// Get described ID, has VTT ID
const { vttIDs, describedIDs } = scanStorage()
writeFileSync(
	join(DIST_PATH, '@described-tracks.txt'),
	`Described:${describedIDs.join(',')}\n\nHas VTT:${vttIDs.join(',')}`,
)

// Zip main data
optimizeCSV()

/**
 * Đọc và xử lý file CSV
 */
function optimizeCSV() {
	const formatedData = data
		.map((row) => {
			const code = row[0]
			if (vttIDs.includes(code) && !row[3].includes('*VTT')) row[3] += ',*VTT'
			if (describedIDs.includes(code)) row[3] += ',*Described'
			return row
		})
		.map((row) =>
			row.map((col, index) =>
				[5, 6].includes(index) && typeof col === 'string' && col.length ? convertQuotes(col.trim()) : col,
			),
		)

	// Tối ưu category
	const cvMap = processCategories(formatedData, 2, 'cv.csv')
	const tagMap = processCategories(formatedData, 3, 'tag.csv')
	const seriesMap = processCategories(formatedData, 4, 'series.csv')

	// Tối ưu URL
	processURLs(formatedData, [7, 8, 9], 'prefix.csv')

	// Tạo file track tối ưu hóa
	const optimizedTracks = formatedData.map((line) => {
		line[2] = `"${formatCategoryLine(line[2])
			.map((cv) => cvMap.get(cv))
			.join('-')}"`
		line[3] = `"${formatCategoryLine(line[3])
			.map((tag) => tagMap.get(tag))
			.join('-')}"`
		line[4] = `"${formatCategoryLine(line[4])
			.map((series) => seriesMap.get(series))
			.join('-')}"`
		line[5] = line[5] ? `"${line[5]}"` : `""`
		line[6] = line[6] ? `"${line[6]}"` : `""`
		line[10] = line[10] ? `"${line[10]}"` : `""`
		return line.join(',')
	})

	writeFileSync(
		join(DIST_PATH, 'tracks.csv'),
		'#track_code,#rj-code,#cv_ids,#tag_ids,#series_ids,#eng-name,#jap-name,#thumbnail,#images,#audios,#additional_urls\n'.toUpperCase() +
			optimizedTracks.join('\n'),
	)
	console.log('File CSV đã được tối ưu và lưu tại:', DIST_PATH)
}

/**@param {string} categoryString  */
function formatCategoryLine(categoryString) {
	return Array.from(
		new Set(
			categoryString
				.split(',')
				.map((p) => p.trim())
				.filter(Boolean)
				.filter((c) => !(c.trim().toLowerCase() === 'described'))
				.sort(),
		),
	)
}

/**
 * Tách category và lưu file tối ưu hóa
 * IDs được encode bằng base64 tùy chỉnh để tiết kiệm dung lượng
 */
function processCategories(data, columnIndex, fileName) {
	const categoryMap = new Map()

	data.forEach((line, index) => {
		try {
			const categories = line[columnIndex].split(',')
			categories.forEach((category) => {
				category = category.trim()
				if (!category || category.trim().toLowerCase() === 'described') return
				if (!categoryMap.has(category)) {
					categoryMap.set(category, { count: 0, index: categoryMap.size + 1 })
				}
				categoryMap.get(category).count += 1
			})
		} catch (error) {
			console.log('Error at index:', index)
			console.log('Line before:', data[index - 1])
			console.log(line)
		}
	})

	const categoryEntries = Array.from(categoryMap.entries())
	const optimizedData = categoryEntries.map(([category, { index, count }]) => `${toB64(index)},${category},${count}`)
	writeFileSync(
		join(DIST_PATH, fileName),
		'#category_id,#category_name,#quantity\n'.toUpperCase() + optimizedData.join('\n'),
	)

	// Map tên category → base64 ID (dùng trong tracks.csv)
	const categoryIndexMap = new Map(categoryEntries.map(([category, { index }]) => [category, toB64(index)]))
	return categoryIndexMap
}

/**
 * Xử lý và tối ưu URL
 */
function processURLs(data, columnIndexList, fileName) {
	return processURLsHierarchical(data, columnIndexList, fileName)
}

/**
 * Hierarchical Prefix Compression - Nén prefix theo cấp bậc
 */
function processURLsHierarchical(data, columnIndexList, fileName) {
	console.log('\n> [DataCompressor] Hierarchical Prefix Compression')

	const urlFrequency = new Map()
	data.forEach((line) => {
		columnIndexList.forEach((columnIndex) => {
			const urls = line[columnIndex].replace(/"/g, '').split(',')
			urls.forEach((url) => {
				const cleanURL = url.split('?')[0].trim()
				if (cleanURL) {
					urlFrequency.set(cleanURL, (urlFrequency.get(cleanURL) || 0) + 1)
				}
			})
		})
	})

	const urls = Array.from(urlFrequency.keys())
	console.log(`\t- Số URL unique: ${urls.length}`)

	const level1Prefixes = createLevel1Prefixes(urls, urlFrequency)
	console.log(`\t- Level 1 prefixes: ${level1Prefixes.length}`)

	const hierarchicalResult = createHierarchicalPrefixes(level1Prefixes)
	console.log(`\t- Atoms (level 2+): ${hierarchicalResult.atoms.length}`)

	const prefixMap = applyHierarchicalCompression(data, columnIndexList, urls, level1Prefixes, hierarchicalResult)

	saveHierarchicalPrefixFile(fileName, hierarchicalResult)

	analyzeHierarchicalCompression(urls, urlFrequency, level1Prefixes, hierarchicalResult)

	return prefixMap
}

function createLevel1Prefixes(urls, urlFrequency) {
	const prefixCounts = new Map()

	urls.forEach((url) => {
		const lastSlashIndex = url.lastIndexOf('/')
		if (lastSlashIndex > 0) {
			const prefix = url.substring(0, lastSlashIndex + 1)
			const count = urlFrequency.get(url) || 1
			prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + count)
		}
	})

	return Array.from(prefixCounts.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([prefix, count]) => ({ prefix, count, id: 0 }))
}

function createHierarchicalPrefixes(level1Prefixes) {
	const atoms = new Map()
	const compositions = new Map()
	let atomId = 1

	console.log('\t- Phân tích patterns:')

	const patterns = analyzeCommonPatterns(level1Prefixes.map((p) => p.prefix))

	patterns.forEach((pattern) => {
		if (!atoms.has(pattern.text)) {
			atoms.set(pattern.text, {
				id: atomId++,
				text: pattern.text,
				frequency: pattern.frequency,
				savings: pattern.savings,
			})
			console.log(`\t\tAtom ${atomId - 1}: "${pattern.text}" (${pattern.frequency} lần, tiết kiệm ${pattern.savings})`)
		}
	})

	level1Prefixes.forEach((prefixInfo, index) => {
		const composition = decomposePrefix(prefixInfo.prefix, atoms)
		compositions.set(index + 1, {
			originalPrefix: prefixInfo.prefix,
			composition: composition,
			frequency: prefixInfo.count,
		})
		prefixInfo.id = index + 1
	})

	return {
		atoms: Array.from(atoms.values()),
		compositions: Array.from(compositions.values()),
		level1Prefixes,
	}
}

function analyzeCommonPatterns(prefixes) {
	const patterns = new Map()

	const protocols = ['https://', 'http://', 'ftp://']
	protocols.forEach((protocol) => {
		const count = prefixes.filter((p) => p.startsWith(protocol)).length
		if (count >= 2) {
			const savings = count * protocol.length - (protocol.length + 4) - count * 2
			patterns.set(protocol, { text: protocol, frequency: count, savings, type: 'protocol' })
		}
	})

	const domainPatterns = extractDomainPatterns(prefixes)
	domainPatterns.forEach((pattern) => {
		patterns.set(pattern.text, pattern)
	})

	const pathPatterns = extractPathPatterns(prefixes)
	pathPatterns.forEach((pattern) => {
		patterns.set(pattern.text, pattern)
	})

	return Array.from(patterns.values())
		.filter((p) => p.savings > 50)
		.sort((a, b) => b.savings - a.savings)
}

function extractDomainPatterns(prefixes) {
	const domainCounts = new Map()

	prefixes.forEach((prefix) => {
		try {
			const url = new URL(prefix)
			const hostname = url.hostname
			const parts = hostname.split('.')
			if (parts.length >= 2) {
				const basePattern = parts[0].replace(/\d+$/, '')
				if (basePattern !== parts[0] && basePattern.length >= 2) {
					const domainSuffix = '.' + parts.slice(1).join('.')
					const fullPattern = basePattern + '*' + domainSuffix
					domainCounts.set(fullPattern, (domainCounts.get(fullPattern) || 0) + 1)
				}
				domainCounts.set(hostname, (domainCounts.get(hostname) || 0) + 1)
			}
		} catch (e) {}
	})

	return Array.from(domainCounts.entries())
		.filter(([pattern, count]) => count >= 2)
		.map(([pattern, count]) => ({
			text: pattern,
			frequency: count,
			savings: count * pattern.length - (pattern.length + 4) - count * 2, // overhead: def row + ref "id>"
			type: 'domain',
		}))
}

function extractPathPatterns(prefixes) {
	const pathCounts = new Map()

	prefixes.forEach((prefix) => {
		try {
			const url = new URL(prefix)
			const pathSegments = url.pathname.split('/').filter(Boolean)
			for (let i = 1; i <= Math.min(pathSegments.length, 7); i++) {
				const pathPrefix = '/' + pathSegments.slice(0, i).join('/') + '/'
				pathCounts.set(pathPrefix, (pathCounts.get(pathPrefix) || 0) + 1)
			}
		} catch (e) {}
	})

	return Array.from(pathCounts.entries())
		.filter(([path, count]) => count >= 2 && path.length >= 8)
		.map(([path, count]) => ({
			text: path,
			frequency: count,
			savings: count * path.length - (path.length + 4) - count * 2, // overhead: def row + ref "id>"
			type: 'path',
		}))
}

function decomposePrefix(prefix, atoms) {
	const atomsList = Array.from(atoms.values()).sort((a, b) => b.text.length - a.text.length)
	const composition = []
	let remaining = prefix

	while (remaining.length > 0) {
		let matched = false

		for (const atom of atomsList) {
			if (remaining.startsWith(atom.text)) {
				composition.push({ type: 'atom', id: atom.id, text: atom.text })
				remaining = remaining.substring(atom.text.length)
				matched = true
				break
			}
		}

		if (!matched) {
			const nextChar = remaining[0]
			const lastPart = composition[composition.length - 1]
			if (lastPart && lastPart.type === 'literal') {
				lastPart.text += nextChar
			} else {
				composition.push({ type: 'literal', text: nextChar })
			}
			remaining = remaining.substring(1)
		}
	}

	return composition
}

/**
 * Áp dụng hierarchical compression (ghi base64 ID vào CSV data)
 */
function applyHierarchicalCompression(data, columnIndexList, urls, level1Prefixes, hierarchicalResult) {
	// Map original prefix string → base64 ID string
	const prefixToIdMap = new Map()
	level1Prefixes.forEach((p) => {
		prefixToIdMap.set(p.prefix, toB64(p.id))
	})

	data.forEach((line) => {
		columnIndexList.forEach((columnIndex) => {
			const urls = line[columnIndex].replace(/"/g, '').split(',')
			const compressedUrls = urls.map((url) => {
				const cleanURL = url.split('?')[0].trim()
				if (!cleanURL) return url

				const lastSlashIndex = cleanURL.lastIndexOf('/')
				if (lastSlashIndex > 0) {
					const prefix = cleanURL.substring(0, lastSlashIndex + 1)
					let name = cleanURL.substring(lastSlashIndex + 1)
					const prefixId = prefixToIdMap.get(prefix)

					name = decodeURIComponent(name)

					if (prefixId) {
						return `${prefixId}->${name}`
					}
				}

				return cleanURL
			})

			line[columnIndex] = `"${compressedUrls.join('/')}"`
		})
	})

	return prefixToIdMap
}

/**
 * Lưu file prefix với format hierarchical, dùng base64 IDs
 */
function saveHierarchicalPrefixFile(fileName, hierarchicalResult) {
	const lines = ['#TYPE:(@: Atom)(none: Prefix),#ID,#CONTENT']

	// Atoms: "@,<b64id>,<text>"
	hierarchicalResult.atoms.forEach((atom) => {
		lines.push(`@,${toB64(atom.id)},${atom.text}`)
	})

	// Compositions: "<b64id>,<expression>"
	// Trong expression, atom ref dùng base64: "1>" → "<b64>>"
	hierarchicalResult.compositions.forEach((comp, index) => {
		const compositionStr = comp.composition
			.map((part) => (part.type === 'atom' ? `${toB64(part.id)}>` : part.text))
			.join('')

		lines.push(`${toB64(index + 1)},${compositionStr}`)
	})

	writeFileSync(join(DIST_PATH, fileName), lines.join('\n'))

	console.log(`\n> [DataCompressor] Saved hierarchical prefix file:`)
	console.log(`\t- Atoms: ${hierarchicalResult.atoms.length}`)
	console.log(`\t- Prefixes: ${hierarchicalResult.compositions.length}`)
}

function analyzeHierarchicalCompression(urls, urlFrequency, level1Prefixes, hierarchicalResult) {
	const originalSize = calculateOriginalSize(urls, urlFrequency)
	const level1Result = calculateLevel1CompressionSize(urls, urlFrequency, level1Prefixes)
	const hierarchicalResult_size = calculateHierarchicalCompressionSize(
		urls,
		urlFrequency,
		level1Prefixes,
		hierarchicalResult,
	)

	console.log(`\n> [DataCompressor] Kích thước URLs gốc: ${originalSize} bytes`)
	console.log(`\t- Prefix table: 0 bytes`)
	console.log(`\t- URL data: ${originalSize} bytes`)

	console.log(
		`\n> [DataCompressor] Level 1 compression: ${level1Result.totalSize} bytes (Tiết kiệm: ${(
			((originalSize - level1Result.totalSize) / originalSize) *
			100
		).toFixed(2)}%)`,
	)
	console.log(`\t- Prefix table: ${level1Result.prefixTableSize} bytes`)
	console.log(`\t- Compressed data: ${level1Result.compressedDataSize} bytes`)

	console.log(
		`\n> [DataCompressor] Hierarchical compression: ${hierarchicalResult_size.totalSize} bytes (Tiết kiệm: ${(
			((originalSize - hierarchicalResult_size.totalSize) / originalSize) *
			100
		).toFixed(2)}%)`,
	)
	console.log(`\t- Atom table: ${hierarchicalResult_size.atomTableSize} bytes`)
	console.log(`\t- Composition table: ${hierarchicalResult_size.compositionTableSize} bytes`)
	console.log(`\t- Compressed data: ${hierarchicalResult_size.compressedDataSize} bytes`)

	console.log(
		`\nCải tiến từ Level 1: ${(
			((level1Result.totalSize - hierarchicalResult_size.totalSize) / level1Result.totalSize) *
			100
		).toFixed(2)}%`,
	)
}

function calculateOriginalSize(urls, urlFrequency) {
	return urls.reduce((sum, url) => {
		const frequency = urlFrequency.get(url) || 1
		return sum + url.length * frequency
	}, 0)
}

function calculateLevel1CompressionSize(urls, urlFrequency, level1Prefixes) {
	const headerSize = '#TYPE:(none: Prefix),#ID,#CONTENT\n'.length

	let prefixTableSize = headerSize
	level1Prefixes.forEach((p, index) => {
		// ID giờ là base64
		const line = `${toB64(index + 1)},${p.prefix}\n`
		prefixTableSize += line.length
	})

	const prefixToIdMap = new Map()
	level1Prefixes.forEach((p, index) => {
		prefixToIdMap.set(p.prefix, toB64(index + 1))
	})

	let compressedDataSize = 0
	urls.forEach((url) => {
		const frequency = urlFrequency.get(url) || 1
		const lastSlashIndex = url.lastIndexOf('/')

		if (lastSlashIndex > 0) {
			const prefix = url.substring(0, lastSlashIndex + 1)
			const name = url.substring(lastSlashIndex + 1)
			const prefixId = prefixToIdMap.get(prefix)

			if (prefixId) {
				const decodedName = decodeURIComponent(name)
				const compressedUrl = `${prefixId}->${decodedName}`
				compressedDataSize += compressedUrl.length * frequency
			} else {
				compressedDataSize += url.length * frequency
			}
		} else {
			compressedDataSize += url.length * frequency
		}
	})

	return { prefixTableSize, compressedDataSize, totalSize: prefixTableSize + compressedDataSize }
}

function calculateHierarchicalCompressionSize(urls, urlFrequency, level1Prefixes, hierarchicalResult) {
	const headerSize = '#TYPE:(A: Atom)(none: Prefix),#ID,#CONTENT\n'.length

	let atomTableSize = headerSize
	hierarchicalResult.atoms.forEach((atom) => {
		const line = `A,${toB64(atom.id)},${atom.text}\n`
		atomTableSize += line.length
	})

	let compositionTableSize = 0
	hierarchicalResult.compositions.forEach((comp, index) => {
		const compositionStr = comp.composition
			.map((part) => (part.type === 'atom' ? `${toB64(part.id)}>` : part.text))
			.join('')
		const line = `${toB64(index + 1)},${compositionStr}\n`
		compositionTableSize += line.length
	})

	const prefixToIdMap = new Map()
	level1Prefixes.forEach((p) => {
		prefixToIdMap.set(p.prefix, toB64(p.id))
	})

	let compressedDataSize = 0
	urls.forEach((url) => {
		const frequency = urlFrequency.get(url) || 1
		const lastSlashIndex = url.lastIndexOf('/')

		if (lastSlashIndex > 0) {
			const prefix = url.substring(0, lastSlashIndex + 1)
			const name = url.substring(lastSlashIndex + 1)
			const prefixId = prefixToIdMap.get(prefix)

			if (prefixId) {
				const decodedName = decodeURIComponent(name)
				const compressedUrl = `${prefixId}->${decodedName}`
				compressedDataSize += compressedUrl.length * frequency
			} else {
				compressedDataSize += url.length * frequency
			}
		} else {
			compressedDataSize += url.length * frequency
		}
	})

	const totalSize = atomTableSize + compositionTableSize + compressedDataSize
	return { atomTableSize, compositionTableSize, compressedDataSize, totalSize }
}
