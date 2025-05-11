import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

import data from './exported-data.js';
import { convertQuotes } from './utils.js';

const DIST_PATH = (function getDist() {
	const DIST_PATH = '@database/s1/';
	if (!existsSync(DIST_PATH)) mkdirSync(DIST_PATH, { recursive: true });
	return DIST_PATH;
})();

optimizeCSV();

/**
 * Đọc và xử lý file CSV
 */
function optimizeCSV() {
	const formatedData = data.map((row) =>
		row.map((col, _) => (typeof col === 'string' && col.length ? convertQuotes(col.trim()) : col))
	);

	// Tối ưu category
	const cvMap = processCategories(formatedData, 2, 'cv.csv');
	const tagMap = processCategories(formatedData, 3, 'tag.csv');
	const seriesMap = processCategories(formatedData, 4, 'series.csv');

	// Tối ưu URL
	processURLs(formatedData, [7, 8, 9], 'prefix.csv');

	// Tạo file track tối ưu hóa
	const optimizedTracks = formatedData.map((line) => {
		line[2] = `"${line[2]
			.split(',')
			.map((cv) => cvMap.get(cv))
			.join('-')}"`;
		line[3] = `"${line[3]
			.split(',')
			.map((tag) => tagMap.get(tag))
			.join('-')}"`;
		line[4] = `"${line[4]
			.split(',')
			.map((series) => seriesMap.get(series))
			.join('-')}"`;
		line[5] = `"${line[5]}"`;
		line[6] = `"${line[6]}"`;
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

/**
 * Tách category và lưu file tối ưu hóa
 */
function processCategories(data, columnIndex, fileName) {
	const categoryMap = new Map();

	data.forEach((line) => {
		const categories = line[columnIndex].split(',');
		categories.forEach((category) => {
			category = category.trim();
			if (!category) return;
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
 * Tách URL prefix và lưu file tối ưu hóa
 */
function processURLs(data, columnIndexList, fileName) {
	const prefixMap = new Map();

	data.forEach((line) => {
		columnIndexList.forEach((columnIndex) => {
			const urls = line[columnIndex].replace(/"/g, '').split(',');
			urls.forEach((url) => {
				const cleanURL = url.split('?')[0];
				if (!cleanURL.trim()) {
					// console.log("Line có URL rỗng", line);
					return;
				}
				const prefix = cleanURL.substring(0, cleanURL.lastIndexOf('/') + 1);
				const fileName = cleanURL.substring(cleanURL.lastIndexOf('/') + 1);
				if (!prefixMap.has(prefix)) {
					prefixMap.set(prefix, prefixMap.size + 1);
				}
				line[columnIndex] = line[columnIndex].replace(url, `${prefixMap.get(prefix)}->${fileName}`);
			});
			line[columnIndex] = `"${line[columnIndex]}"`;
		});
	});

	const prefixEntries = Array.from(prefixMap.entries());
	const optimizedData = prefixEntries.map(([prefix, index]) => `${index},${prefix}`);
	writeFileSync(join(DIST_PATH, fileName), '#prefix_id,#prefix\n'.toUpperCase() + optimizedData.join('\n'));

	return prefixMap;
}
