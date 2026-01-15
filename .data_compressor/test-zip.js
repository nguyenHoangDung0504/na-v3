import { existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIST_PATH = (function getDist() {
	const DIST_PATH = join(__dirname, '../@resources/databases/s1/');
	if (!existsSync(DIST_PATH)) throw new Error('Directory not found! Create before run');
	return DIST_PATH;
})();

// Export để so sánh với thuật toán cũ
export { processURLsTokenization };

/**
 * Path Segment Tokenization - SIMPLE VERSION
 * Bẻ hết URL theo dấu "/", mỗi segment là 1 token
 */
function processURLsTokenization(data, columnIndexList, fileName) {
	console.log('\n> [DataCompressor] Path Segment Tokenization (Simple)');

	// Bước 1: Thu thập URLs
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

	// Bước 2: Bẻ tất cả URLs thành segments và đếm frequency
	const segmentFrequency = new Map();
	const urlSegments = new Map(); // Lưu segments của mỗi URL

	urls.forEach((url) => {
		// Bẻ URL theo dấu "/"
		const parts = url.split('/').filter(Boolean);

		// Thêm protocol vào segment đầu
		if (parts.length > 0 && parts[0].includes(':')) {
			parts[0] = parts[0] + '//'; // "https:" → "https://"
		}

		// Lưu segments của URL này (bao gồm cả filename)
		urlSegments.set(url, parts);

		// Đếm frequency - LOẠI BỎ SEGMENT CUỐI (filename)
		const freq = urlFrequency.get(url) || 1;
		const segmentsToCount = parts.slice(0, -1); // Bỏ phần tử cuối

		segmentsToCount.forEach((segment) => {
			// Chỉ đếm segments dài >= 3 ký tự
			if (segment.length >= 3) {
				segmentFrequency.set(segment, (segmentFrequency.get(segment) || 0) + freq);
			}
		});
	});

	console.log(`\t- Tổng số segments unique: ${segmentFrequency.size}`);

	// Bước 3: Tạo tokens cho TẤT CẢ segments xuất hiện >= 2 lần
	const tokens = new Map();
	let tokenId = 1;

	Array.from(segmentFrequency.entries())
		.filter(([segment, freq]) => freq >= 2) // Chỉ cần xuất hiện >= 2 lần
		.sort((a, b) => b[1] - a[1]) // Sort theo frequency
		.forEach(([segment, freq]) => {
			tokens.set(segment, {
				id: tokenId++,
				text: segment,
				frequency: freq,
			});
		});

	console.log(`\t- Tokens được tạo (freq >= 2): ${tokens.size}`);

	// Debug: In top 20 tokens
	console.log(`\n\t=== Top 20 tokens (sorted by savings) ===`);

	// Tính savings cho mỗi token
	const tokensWithSavings = Array.from(tokens.values()).map((token) => {
		const tokenStr = `T${token.id}`;
		const savedPerUse = token.text.length - tokenStr.length;
		const totalSavings = savedPerUse * token.frequency;
		return { ...token, savedPerUse, totalSavings };
	});

	tokensWithSavings
		.sort((a, b) => b.totalSavings - a.totalSavings)
		.slice(0, 20)
		.forEach((token, i) => {
			console.log(
				`\t  ${i + 1}. T${token.id}: "${token.text}" (${token.frequency}×, saves ${token.totalSavings} bytes)`
			);
		});

	// Bước 4: Encode mỗi URL thành chuỗi token IDs
	const urlEncodings = new Map();

	urls.forEach((url) => {
		const parts = urlSegments.get(url);
		const encoding = parts.map((segment, index) => {
			// LUÔN GIỮ NGUYÊN SEGMENT CUỐI (filename)
			const isFilename = index === parts.length - 1;
			if (isFilename) {
				return segment;
			}

			// Với các segments khác, check xem có token không
			const token = tokens.get(segment);
			if (token) {
				// So sánh cost: nếu "T{id}" dài hơn segment gốc → giữ nguyên
				const tokenStr = `T${token.id}`;
				if (tokenStr.length >= segment.length) {
					return segment; // Giữ nguyên vì không lợi
				}
				return tokenStr;
			} else {
				// Không có token (segment ngắn < 3 chars hoặc freq < 2)
				return segment;
			}
		});

		urlEncodings.set(url, encoding);
	});

	// Bước 5: Áp dụng vào data
	data.forEach((line) => {
		columnIndexList.forEach((columnIndex) => {
			const urls = line[columnIndex].replace(/"/g, '').split(',');
			const compressedUrls = urls.map((url) => {
				const cleanURL = url.split('?')[0].trim();
				if (!cleanURL) return url;

				const encoding = urlEncodings.get(cleanURL);
				if (encoding) {
					// Join bằng "/" để giữ cấu trúc
					return encoding.join('/');
				}

				return cleanURL;
			});

			line[columnIndex] = `"${compressedUrls.join(',')}"`;
		});
	});

	// Bước 6: Lưu file tokens
	const tokenFileContent = saveTokenFile(fileName, tokens);

	// Bước 7: Phân tích
	analyzeCompression(urls, urlFrequency, tokens, urlEncodings, tokenFileContent);

	return { tokens, urlEncodings };
}

/**
 * Lưu file tokens
 */
function saveTokenFile(fileName, tokens) {
	const lines = ['#ID,#SEGMENT'];

	// Sort tokens theo ID
	Array.from(tokens.values())
		.sort((a, b) => a.id - b.id)
		.forEach((token) => {
			lines.push(`${token.id},${token.text}`);
		});

	const content = lines.join('\n');
	console.log(`\n> [DataCompressor] Token file: ${lines.length - 1} tokens, ${content.length} bytes`);

	// Uncomment để lưu thực tế
	// writeFileSync(join(DIST_PATH, fileName), content);

	return content;
}

/**
 * Phân tích compression
 */
function analyzeCompression(urls, urlFrequency, tokens, urlEncodings, tokenFileContent) {
	// 1. Kích thước gốc
	let originalSize = 0;
	urls.forEach((url) => {
		const freq = urlFrequency.get(url) || 1;
		originalSize += url.length * freq;
	});

	// 2. Kích thước token file
	const tokenFileSize = tokenFileContent.length;

	// 3. Kích thước data sau nén
	let compressedDataSize = 0;
	urls.forEach((url) => {
		const freq = urlFrequency.get(url) || 1;
		const encoding = urlEncodings.get(url);

		if (encoding) {
			// Tính độ dài sau encode: "T1/T2/segment/T3/file.jpg"
			const encodedLength = encoding.join('/').length;
			compressedDataSize += encodedLength * freq;
		} else {
			compressedDataSize += url.length * freq;
		}
	});

	const totalSize = tokenFileSize + compressedDataSize;
	const savedBytes = originalSize - totalSize;
	const savedPercent = (savedBytes / originalSize) * 100;

	console.log(`\n> [DataCompressor] === COMPRESSION RESULTS ===`);
	console.log(`\t- Original size: ${originalSize.toLocaleString()} bytes`);
	console.log(`\t- Token file: ${tokenFileSize.toLocaleString()} bytes`);
	console.log(`\t- Compressed data: ${compressedDataSize.toLocaleString()} bytes`);
	console.log(`\t- Total: ${totalSize.toLocaleString()} bytes`);
	console.log(`\t- Saved: ${savedBytes.toLocaleString()} bytes (${savedPercent.toFixed(2)}%)`);

	// Phân tích token usage
	console.log(`\n> Token statistics:`);
	const tokenUsage = Array.from(tokens.values()).sort((a, b) => b.frequency - a.frequency);

	const top5 = tokenUsage.slice(0, 5);
	console.log(`\t- Top 5 most used:`);
	top5.forEach((t, i) => {
		const saving = (t.text.length - `T${t.id}`.length) * t.frequency;
		console.log(`\t  ${i + 1}. "${t.text}" → T${t.id} (${t.frequency}×, saves ${saving} bytes)`);
	});

	const longest5 = tokenUsage.sort((a, b) => b.text.length - a.text.length).slice(0, 5);
	console.log(`\t- Top 5 longest:`);
	longest5.forEach((t, i) => {
		console.log(`\t  ${i + 1}. "${t.text}" (${t.text.length} chars, ${t.frequency}×)`);
	});

	return {
		originalSize,
		tokenFileSize,
		compressedDataSize,
		totalSize,
		savedBytes,
		savedPercent,
	};
}
