import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';

import data from '../exported-data.js';
import { convertQuotes } from '../utils.js';

const DIST_PATH = (function getDist() {
	const DIST_PATH = '@resources/databases/s1-test/';
	if (!existsSync(DIST_PATH)) throw new Error('Directory not found! Create before run');
	return DIST_PATH;
})();

optimizeCSV();

/**
 * Đọc và xử lý file CSV
 */
function optimizeCSV() {
	const formatedData = data.map((row) =>
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
	console.log('\n=== HIERARCHICAL PREFIX COMPRESSION ===');

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
	console.log(`Số URL unique: ${urls.length}`);

	// Bước 2: Tạo level 1 prefixes (tách tại / cuối)
	const level1Prefixes = createLevel1Prefixes(urls, urlFrequency);
	console.log(`Level 1 prefixes: ${level1Prefixes.length}`);

	// Bước 3: Phân tích và tạo hierarchical compression
	const hierarchicalResult = createHierarchicalPrefixes(level1Prefixes);
	console.log(`Atoms (level 2+): ${hierarchicalResult.atoms.length}`);

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

	console.log('\n--- Phân tích patterns ---');

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
			console.log(`Atom ${atomId - 1}: "${pattern.text}" (${pattern.frequency} lần, tiết kiệm ${pattern.savings})`);
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
					const name = cleanURL.substring(lastSlashIndex + 1);
					const prefixId = prefixToIdMap.get(prefix);

					if (prefixId) {
						return `${prefixId}->${name}`;
					}
				}

				return cleanURL;
			});

			line[columnIndex] = `"${compressedUrls.join(',')}"`;
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

	console.log(`\nSaved hierarchical prefix file:`);
	console.log(`- Atoms: ${hierarchicalResult.atoms.length}`);
	console.log(`- Prefixes: ${hierarchicalResult.compositions.length}`);
}

/**
 * Phân tích hiệu quả hierarchical compression
 */
function analyzeHierarchicalCompression(urls, urlFrequency, level1Prefixes, hierarchicalResult) {
	// Kích thước gốc
	const originalSize = urls.reduce((sum, url) => sum + url.length * (urlFrequency.get(url) || 1), 0);

	// Kích thước với level 1 compression (như cũ)
	const level1Size = calculateLevel1Size(urls, urlFrequency, level1Prefixes);

	// Kích thước với hierarchical compression
	const hierarchicalSize = calculateHierarchicalSize(urls, urlFrequency, level1Prefixes, hierarchicalResult);

	console.log('\n=== PHÂN TÍCH KẾT QUẢ ===');
	console.log(`Kích thước gốc: ${originalSize} bytes`);
	console.log(
		`Level 1 compression: ${level1Size} bytes (${(((originalSize - level1Size) / originalSize) * 100).toFixed(
			2
		)}% tiết kiệm)`
	);
	console.log(
		`Hierarchical compression: ${hierarchicalSize} bytes (${(
			((originalSize - hierarchicalSize) / originalSize) *
			100
		).toFixed(2)}% tiết kiệm)`
	);
	console.log(`Cải tiến từ Level 1: ${(((level1Size - hierarchicalSize) / level1Size) * 100).toFixed(2)}%`);
}

function calculateLevel1Size(urls, urlFrequency, level1Prefixes) {
	let size = 0;

	// Prefix table size
	level1Prefixes.forEach((p) => {
		size += p.prefix.length + 10;
	});

	// Tracks size
	urls.forEach((url) => {
		const freq = urlFrequency.get(url) || 1;
		const lastSlash = url.lastIndexOf('/');
		const nameLength = url.length - lastSlash - 1;
		size += (nameLength + 8) * freq; // 8 for "123->"
	});

	return size;
}

function calculateHierarchicalSize(urls, urlFrequency, level1Prefixes, hierarchicalResult) {
	let size = 0;

	// Atoms size
	hierarchicalResult.atoms.forEach((atom) => {
		size += atom.text.length + 10;
	});

	// Compositions size
	hierarchicalResult.compositions.forEach((comp) => {
		const compositionLength = comp.composition.reduce((len, part) => {
			return len + (part.type === 'atom' ? 3 : part.text.length); // "@123" = 4 chars
		}, 0);
		size += compositionLength + 10;
	});

	// Tracks size (same as level 1)
	urls.forEach((url) => {
		const freq = urlFrequency.get(url) || 1;
		const lastSlash = url.lastIndexOf('/');
		const nameLength = url.length - lastSlash - 1;
		size += (nameLength + 8) * freq;
	});

	return size;
}
