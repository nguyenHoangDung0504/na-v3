import { existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { data } from './storage/index.js';
import { convertQuotes } from './utils.js';
import getDescribedTrackID from './getDescribedTrackID.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIST_PATH = (function getDist() {
	const DIST_PATH = join(__dirname, '../@resources/databases/s1/');
	if (!existsSync(DIST_PATH)) throw new Error('Directory not found! Create before run');
	return DIST_PATH;
})();

// Get described ID, has VTT ID
const [vttIDs, describedIDs] = await Promise.all([
	getDescribedTrackID(join(__dirname, '../@descriptions/vtts/')),
	getDescribedTrackID(join(__dirname, '../@descriptions/storage/')),
]);
// writeFileSync(
// 	join(DIST_PATH, '@described-tracks.txt'),
// 	`Described:${describedIDs.join(',')}\n\nHas VTT:${vttIDs.join(',')}`
// );

// Zip main data
optimizeCSV();

/**
 * Đọc và xử lý file CSV
 */
function optimizeCSV() {
	const formatedData = data
		.map((row) => {
			const code = row[0];
			if (vttIDs.includes(code) && !row[3].includes('*VTT')) row[3] += ',*VTT';
			if (describedIDs.includes(code)) row[3] += ',*Described';
			return row;
		})
		.map((row) =>
			row.map((col, index) =>
				[5, 6].includes(index) && typeof col === 'string' && col.length // Chỉ convertQuotes trên col engname, japname
					? convertQuotes(col.trim())
					: col
			)
		);

	// Tối ưu category
	const cvMap = processCategories(formatedData, 2, 'cv.csv');
	const tagMap = processCategories(formatedData, 3, 'tag.csv');
	const seriesMap = processCategories(formatedData, 4, 'series.csv');

	// Tối ưu URL
	processURLs(formatedData, [7, 8, 9], 'prefix.csv');

	// Tạo file track tối ưu hóa
	const optimizedTracks = formatedData.map((line) => {
		line[2] = `"${formatCategoryLine(line[2])
			.map((cv) => cvMap.get(cv))
			.join('-')}"`;
		line[3] = `"${formatCategoryLine(line[3])
			.map((tag) => tagMap.get(tag))
			.join('-')}"`;
		line[4] = `"${formatCategoryLine(line[4])
			.map((series) => seriesMap.get(series))
			.join('-')}"`;
		line[5] = line[5] ? `"${line[5]}"` : `""`;
		line[6] = line[6] ? `"${line[6]}"` : `""`;
		line[10] = line[10] ? `"${line[10]}"` : `""`;
		return line.join(',');
	});

	writeFileSync(
		join(DIST_PATH, 'tracks.csv'),
		'#track_code,#rj-code,#cv_ids,#tag_ids,#series_ids,#eng-name,#jap-name,#thumbnail,#images,#audios,#additional_urls\n'.toUpperCase() +
			optimizedTracks.join('\n')
	);
	console.log('File CSV đã được tối ưu và lưu tại:', DIST_PATH);
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
				.sort()
		)
	);
}

/**
 * Tách category và lưu file tối ưu hóa
 */
function processCategories(data, columnIndex, fileName) {
	const categoryMap = new Map();

	data.forEach((line) => {
		const categories = line[columnIndex].split(',');
		categories.forEach((category) => {
			category = category.trim();
			if (!category || category.trim().toLowerCase() === 'described') return;
			if (!categoryMap.has(category)) {
				categoryMap.set(category, { count: 0, index: categoryMap.size + 1 });
			}
			categoryMap.get(category).count += 1;
		});
	});

	const categoryEntries = Array.from(categoryMap.entries());
	const optimizedData = categoryEntries.map(([category, { index, count }]) => `${index},${category},${count}`);
	writeFileSync(
		join(DIST_PATH, fileName),
		'#category_id,#category_name,#quantity\n'.toUpperCase() + optimizedData.join('\n')
	);

	const categoryIndexMap = new Map(categoryEntries.map(([category, { index }]) => [category, index]));
	return categoryIndexMap;
}

/**
 * Xử lý và tối ưu URL
 */
function processURLs(data, columnIndexList, fileName) {
	return processURLsHierarchical(data, columnIndexList, fileName);
}

/**
 * Hierarchical Prefix Compression - Nén prefix theo cấp bậc
 */
function processURLsHierarchical(data, columnIndexList, fileName) {
	console.log('\n> [DataCompressor] Hierarchical Prefix Compression');

	// Bước 1: Thu thập URLs và tạo prefix level 1 (như cũ)
	const urlFrequency = new Map();
	data.forEach((line) => {
		columnIndexList.forEach((columnIndex) => {
			const urls = line[columnIndex].replace(/"/g, '').split(',');
			urls.forEach((url) => {
				const cleanURL = url.split('?')[0].trim();
				if (cleanURL) {
					urlFrequency.set(cleanURL, (urlFrequency.get(cleanURL) || 0) + 1);
				}
			});
		});
	});

	const urls = Array.from(urlFrequency.keys());
	console.log(`\t- Số URL unique: ${urls.length}`);

	// Bước 2: Tạo level 1 prefixes (tách tại / cuối)
	const level1Prefixes = createLevel1Prefixes(urls, urlFrequency);
	console.log(`\t- Level 1 prefixes: ${level1Prefixes.length}`);

	// Bước 3: Phân tích và tạo hierarchical compression
	const hierarchicalResult = createHierarchicalPrefixes(level1Prefixes);
	console.log(`\t- Atoms (level 2+): ${hierarchicalResult.atoms.length}`);

	// Bước 4: Áp dụng compression vào data
	const prefixMap = applyHierarchicalCompression(data, columnIndexList, urls, level1Prefixes, hierarchicalResult);

	// Bước 5: Lưu file với format hierarchical
	saveHierarchicalPrefixFile(fileName, hierarchicalResult);

	// Bước 6: Phân tích kết quả
	analyzeHierarchicalCompression(urls, urlFrequency, level1Prefixes, hierarchicalResult);

	return prefixMap;
}

/**
 * Tạo level 1 prefixes (như thuật toán cũ)
 */
function createLevel1Prefixes(urls, urlFrequency) {
	const prefixCounts = new Map();

	urls.forEach((url) => {
		const lastSlashIndex = url.lastIndexOf('/');
		if (lastSlashIndex > 0) {
			const prefix = url.substring(0, lastSlashIndex + 1);
			const count = urlFrequency.get(url) || 1;
			prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + count);
		}
	});

	return Array.from(prefixCounts.entries())
		.sort((a, b) => b[1] - a[1]) // Sort theo frequency
		.map(([prefix, count]) => ({ prefix, count, id: 0 }));
}

/**
 * Tạo hierarchical compression
 */
function createHierarchicalPrefixes(level1Prefixes) {
	const atoms = new Map(); // Atomic pieces
	const compositions = new Map(); // Cách compose từ atoms
	let atomId = 1;

	console.log('\t- Phân tích patterns:');

	// Phân tích các pattern chung
	const patterns = analyzeCommonPatterns(level1Prefixes.map((p) => p.prefix));

	// Tạo atoms từ patterns
	patterns.forEach((pattern) => {
		if (!atoms.has(pattern.text)) {
			atoms.set(pattern.text, {
				id: atomId++,
				text: pattern.text,
				frequency: pattern.frequency,
				savings: pattern.savings,
			});
			console.log(`\t\tAtom ${atomId - 1}: "${pattern.text}" (${pattern.frequency} lần, tiết kiệm ${pattern.savings})`);
		}
	});

	// Tạo compositions cho mỗi level1 prefix
	level1Prefixes.forEach((prefixInfo, index) => {
		const composition = decomposePrefix(prefixInfo.prefix, atoms);
		compositions.set(index + 1, {
			originalPrefix: prefixInfo.prefix,
			composition: composition,
			frequency: prefixInfo.count,
		});
		prefixInfo.id = index + 1;
	});

	return {
		atoms: Array.from(atoms.values()),
		compositions: Array.from(compositions.values()),
		level1Prefixes,
	};
}

/**
 * Phân tích patterns chung trong prefixes
 */
function analyzeCommonPatterns(prefixes) {
	const patterns = new Map();

	// Pattern 1: Protocol
	const protocols = ['https://', 'http://', 'ftp://'];
	protocols.forEach((protocol) => {
		const count = prefixes.filter((p) => p.startsWith(protocol)).length;
		if (count >= 2) {
			const savings = count * protocol.length - protocol.length - 10;
			patterns.set(protocol, {
				text: protocol,
				frequency: count,
				savings,
				type: 'protocol',
			});
		}
	});

	// Pattern 2: Common domains/subdomains
	const domainPatterns = extractDomainPatterns(prefixes);
	domainPatterns.forEach((pattern) => {
		patterns.set(pattern.text, pattern);
	});

	// Pattern 3: Common paths
	const pathPatterns = extractPathPatterns(prefixes);
	pathPatterns.forEach((pattern) => {
		patterns.set(pattern.text, pattern);
	});

	// Chỉ giữ patterns có lợi ích > 0
	return Array.from(patterns.values())
		.filter((p) => p.savings > 0)
		.sort((a, b) => b.savings - a.savings);
}

/**
 * Extract domain patterns
 */
function extractDomainPatterns(prefixes) {
	const domainCounts = new Map();

	prefixes.forEach((prefix) => {
		try {
			const url = new URL(prefix);
			const hostname = url.hostname;

			// Extract subdomain patterns
			const parts = hostname.split('.');
			if (parts.length >= 2) {
				// Check cho patterns như cdn1, cdn2, api1, api2
				const basePattern = parts[0].replace(/\d+$/, ''); // Remove numbers
				if (basePattern !== parts[0] && basePattern.length >= 2) {
					const domainSuffix = '.' + parts.slice(1).join('.');
					const fullPattern = basePattern + '*' + domainSuffix;
					domainCounts.set(fullPattern, (domainCounts.get(fullPattern) || 0) + 1);
				}

				// Check cho exact domain matches
				domainCounts.set(hostname, (domainCounts.get(hostname) || 0) + 1);
			}
		} catch (e) {
			// Skip invalid URLs
		}
	});

	return Array.from(domainCounts.entries())
		.filter(([pattern, count]) => count >= 2)
		.map(([pattern, count]) => ({
			text: pattern,
			frequency: count,
			savings: count * pattern.length - pattern.length - 10,
			type: 'domain',
		}));
}

/**
 * Extract path patterns
 */
function extractPathPatterns(prefixes) {
	const pathCounts = new Map();

	prefixes.forEach((prefix) => {
		try {
			const url = new URL(prefix);
			const pathSegments = url.pathname.split('/').filter(Boolean);

			// Check các path prefix chung
			for (let i = 1; i <= Math.min(pathSegments.length, 3); i++) {
				const pathPrefix = '/' + pathSegments.slice(0, i).join('/') + '/';
				pathCounts.set(pathPrefix, (pathCounts.get(pathPrefix) || 0) + 1);
			}
		} catch (e) {
			// Skip invalid URLs
		}
	});

	return Array.from(pathCounts.entries())
		.filter(([path, count]) => count >= 3 && path.length >= 5)
		.map(([path, count]) => ({
			text: path,
			frequency: count,
			savings: count * path.length - path.length - 10,
			type: 'path',
		}));
}

/**
 * Decompose một prefix thành atoms
 */
function decomposePrefix(prefix, atoms) {
	const atomsList = Array.from(atoms.values()).sort((a, b) => b.text.length - a.text.length);
	const composition = [];
	let remaining = prefix;

	while (remaining.length > 0) {
		let matched = false;

		// Tìm atom dài nhất match với phần đầu của remaining
		for (const atom of atomsList) {
			if (remaining.startsWith(atom.text)) {
				composition.push({ type: 'atom', id: atom.id, text: atom.text });
				remaining = remaining.substring(atom.text.length);
				matched = true;
				break;
			}
		}

		if (!matched) {
			// Không match được atom nào, lấy ký tự tiếp theo
			const nextChar = remaining[0];
			const lastPart = composition[composition.length - 1];

			if (lastPart && lastPart.type === 'literal') {
				lastPart.text += nextChar;
			} else {
				composition.push({ type: 'literal', text: nextChar });
			}

			remaining = remaining.substring(1);
		}
	}

	return composition;
}

/**
 * Áp dụng hierarchical compression vào data
 */
function applyHierarchicalCompression(data, columnIndexList, urls, level1Prefixes, hierarchicalResult) {
	// Tạo mapping từ original prefix → level1 ID
	const prefixToIdMap = new Map();
	level1Prefixes.forEach((p) => {
		prefixToIdMap.set(p.prefix, p.id);
	});

	// Áp dụng compression
	data.forEach((line) => {
		columnIndexList.forEach((columnIndex) => {
			const urls = line[columnIndex].replace(/"/g, '').split(',');
			const compressedUrls = urls.map((url) => {
				const cleanURL = url.split('?')[0].trim();
				if (!cleanURL) return url;

				const lastSlashIndex = cleanURL.lastIndexOf('/');
				if (lastSlashIndex > 0) {
					const prefix = cleanURL.substring(0, lastSlashIndex + 1);
					let name = cleanURL.substring(lastSlashIndex + 1);
					const prefixId = prefixToIdMap.get(prefix);

					// Note: update 17/8/2025, test decodeURIComponent for compress
					name = decodeURIComponent(name);

					if (prefixId) {
						return `${prefixId}->${name}`;
					}
				}

				return cleanURL;
			});

			line[columnIndex] = `"${compressedUrls.join('/')}"`;
		});
	});

	return prefixToIdMap;
}

/**
 * Lưu file prefix với format hierarchical
 */
function saveHierarchicalPrefixFile(fileName, hierarchicalResult) {
	const lines = ['#TYPE:(A: Atom)(none: Prefix),#ID,#CONTENT'];

	// Lưu atoms trước
	hierarchicalResult.atoms.forEach((atom) => {
		lines.push(`A,${atom.id},${atom.text}`);
	});

	// Lưu compositions
	hierarchicalResult.compositions.forEach((comp, index) => {
		const compositionStr = comp.composition
			.map((part) => {
				if (part.type === 'atom') {
					return `${part.id}>`;
				} else {
					return part.text;
				}
			})
			.join('');

		lines.push(`${index + 1},${compositionStr}`);
	});

	writeFileSync(join(DIST_PATH, fileName), lines.join('\n'));

	console.log(`\n> [DataCompressor] Saved hierarchical prefix file:`);
	console.log(`\t- Atoms: ${hierarchicalResult.atoms.length}`);
	console.log(`\t- Prefixes: ${hierarchicalResult.compositions.length}`);
}

/**
 * Phân tích hiệu quả hierarchical compression
 */
function analyzeHierarchicalCompression(urls, urlFrequency, level1Prefixes, hierarchicalResult) {
	// Tính kích thước gốc (URLs nguyên bản)
	const originalSize = calculateOriginalSize(urls, urlFrequency);

	// Tính kích thước với level 1 compression
	const level1Result = calculateLevel1CompressionSize(urls, urlFrequency, level1Prefixes);

	// Tính kích thước với hierarchical compression
	const hierarchicalResult_size = calculateHierarchicalCompressionSize(
		urls,
		urlFrequency,
		level1Prefixes,
		hierarchicalResult
	);

	console.log(`\n> [DataCompressor] Kích thước URLs gốc: ${originalSize} bytes`);
	console.log(`\t- Prefix table: 0 bytes`);
	console.log(`\t- URL data: ${originalSize} bytes`);

	console.log(
		`\n> [DataCompressor] Level 1 compression: ${level1Result.totalSize} bytes (Tiết kiệm: ${(
			((originalSize - level1Result.totalSize) / originalSize) *
			100
		).toFixed(2)}%)`
	);
	console.log(`\t- Prefix table: ${level1Result.prefixTableSize} bytes`);
	console.log(`\t- Compressed data: ${level1Result.compressedDataSize} bytes`);

	console.log(
		`\n> [DataCompressor] Hierarchical compression: ${hierarchicalResult_size.totalSize} bytes (Tiết kiệm: ${(
			((originalSize - hierarchicalResult_size.totalSize) / originalSize) *
			100
		).toFixed(2)}%)`
	);
	console.log(`\t- Atom table: ${hierarchicalResult_size.atomTableSize} bytes`);
	console.log(`\t- Composition table: ${hierarchicalResult_size.compositionTableSize} bytes`);
	console.log(`\t- Compressed data: ${hierarchicalResult_size.compressedDataSize} bytes`);

	console.log(
		`\nCải tiến từ Level 1: ${(
			((level1Result.totalSize - hierarchicalResult_size.totalSize) / level1Result.totalSize) *
			100
		).toFixed(2)}%`
	);
}

/**
 * Tính kích thước URLs gốc
 */
function calculateOriginalSize(urls, urlFrequency) {
	return urls.reduce((sum, url) => {
		const frequency = urlFrequency.get(url) || 1;
		return sum + url.length * frequency;
	}, 0);
}

/**
 * Tính kích thước với Level 1 compression - FIXED
 */
function calculateLevel1CompressionSize(urls, urlFrequency, level1Prefixes) {
	// 1. Kích thước bảng prefix
	// Format: #TYPE:(none: Prefix),#ID,#CONTENT
	const headerSize = '#TYPE:(none: Prefix),#ID,#CONTENT\n'.length;

	let prefixTableSize = headerSize;
	level1Prefixes.forEach((p, index) => {
		// Format: "ID,PREFIX_CONTENT\n"
		const line = `${index + 1},${p.prefix}\n`;
		prefixTableSize += line.length;
	});

	// 2. Tạo map từ prefix -> ID để tính compressed data
	const prefixToIdMap = new Map();
	level1Prefixes.forEach((p, index) => {
		prefixToIdMap.set(p.prefix, index + 1);
	});

	// 3. Kích thước data sau nén
	let compressedDataSize = 0;
	urls.forEach((url) => {
		const frequency = urlFrequency.get(url) || 1;
		const lastSlashIndex = url.lastIndexOf('/');

		if (lastSlashIndex > 0) {
			const prefix = url.substring(0, lastSlashIndex + 1);
			const name = url.substring(lastSlashIndex + 1);
			const prefixId = prefixToIdMap.get(prefix);

			if (prefixId) {
				// Format: "ID->name" (đã decode name)
				const decodedName = decodeURIComponent(name);
				const compressedUrl = `${prefixId}->${decodedName}`;
				compressedDataSize += compressedUrl.length * frequency;
			} else {
				// Không nén được, giữ nguyên
				compressedDataSize += url.length * frequency;
			}
		} else {
			// Không có slash, giữ nguyên
			compressedDataSize += url.length * frequency;
		}
	});

	const totalSize = prefixTableSize + compressedDataSize;

	return {
		prefixTableSize,
		compressedDataSize,
		totalSize,
	};
}

/**
 * Tính kích thước với Hierarchical compression - FIXED
 */
function calculateHierarchicalCompressionSize(urls, urlFrequency, level1Prefixes, hierarchicalResult) {
	// 1. Kích thước bảng atoms
	// Header: #TYPE:(A: Atom)(none: Prefix),#ID,#CONTENT
	const headerSize = '#TYPE:(A: Atom)(none: Prefix),#ID,#CONTENT\n'.length;

	let atomTableSize = headerSize;
	hierarchicalResult.atoms.forEach((atom) => {
		// Format: "A,ID,CONTENT\n"
		const line = `A,${atom.id},${atom.text}\n`;
		atomTableSize += line.length;
	});

	// 2. Kích thước bảng compositions
	let compositionTableSize = 0;
	hierarchicalResult.compositions.forEach((comp, index) => {
		// Tạo composition string theo format mới
		const compositionStr = comp.composition
			.map((part) => {
				if (part.type === 'atom') {
					return `${part.id}>`; // Format: "ID>"
				} else {
					return part.text; // Literal text
				}
			})
			.join('');

		// Format: "ID,COMPOSITION_STRING\n"
		const line = `${index + 1},${compositionStr}\n`;
		compositionTableSize += line.length;
	});

	// 3. Tạo map từ prefix -> ID để tính compressed data
	const prefixToIdMap = new Map();
	level1Prefixes.forEach((p) => {
		prefixToIdMap.set(p.prefix, p.id);
	});

	// 4. Kích thước data sau nén (giống như Level 1)
	let compressedDataSize = 0;
	urls.forEach((url) => {
		const frequency = urlFrequency.get(url) || 1;
		const lastSlashIndex = url.lastIndexOf('/');

		if (lastSlashIndex > 0) {
			const prefix = url.substring(0, lastSlashIndex + 1);
			const name = url.substring(lastSlashIndex + 1);
			const prefixId = prefixToIdMap.get(prefix);

			if (prefixId) {
				// Format: "ID->name" (đã decode name)
				const decodedName = decodeURIComponent(name);
				const compressedUrl = `${prefixId}->${decodedName}`;
				compressedDataSize += compressedUrl.length * frequency;
			} else {
				// Không nén được, giữ nguyên
				compressedDataSize += url.length * frequency;
			}
		} else {
			// Không có slash, giữ nguyên
			compressedDataSize += url.length * frequency;
		}
	});

	const totalSize = atomTableSize + compositionTableSize + compressedDataSize;

	return {
		atomTableSize,
		compositionTableSize,
		compressedDataSize,
		totalSize,
	};
}
