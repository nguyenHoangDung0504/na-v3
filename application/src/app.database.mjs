import { Category, OtherLink, SearchSuggestion, Track } from './app.models.mjs';
import { sort } from './app.utils.mjs';

/**Tạo new URL với mỗi assets URL để throw lỗi khi URL sai định dạng, mặc định tắt vì khá nặng */
const CHECK_URL = false;

export default class Database {
	/**@type {Map<number, Category<'cv'>>} */
	cvs = new Map();

	/**@type {Map<number, Category<'series'>>} */
	series = new Map();

	/**@type {Map<number, Category<'tag'>>} */
	tags = new Map();

	/**@type {Map<number, Track>} */
	tracks = new Map();

	/**@type {Map<`RJ${number}`, number>} */
	codeMap = new Map();

	/**@type {number[]} */
	keyList = [];

	static async create(storagePath = '/resources/database.csv') {
		const rawCSV = await (await fetch(storagePath)).text();
		return new Database(parseRawCSV(rawCSV));
	}

	/**
	 * @param {ReturnType<typeof parseRawCSV>} parsedCSV
	 */
	constructor(parsedCSV) {
		const { cv, series, tag, tracks, url_prefix } = parsedCSV;
		const prefixMap = new Map(url_prefix.split('\n').map((line) => line.split(',')));

		const decompressURL = (compressedURL) => {
			const [prefixID, path] = compressedURL.split('->');
			return `${prefixMap.get(prefixID)}${path}`;
		};
		const storageCategory = (rawString, categoryType, storage) =>
			rawString.split('\n').forEach((row) => {
				const [id, name, quantity] = row.split(',');
				storage.set(+id, new Category(categoryType, name, +quantity));
			});

		storageCategory(cv, 'cv', this.cvs);
		storageCategory(tag, 'tag', this.tags);
		storageCategory(series, 'series', this.series);

		// Storage tracks
		tracks.split('\n').forEach((row) => {
			const paresdLine = parseTrackLine(row);
			paresdLine[0] = +paresdLine[0]; // convert code to type number

			const [code, RJcode, cvIDsStr, tagIDsStr, seriesIDsStr, eName, jName, thumbnail, images, audios, additional] =
				paresdLine;

			const info = new Track.Info(code, RJcode, eName, jName);

			const categories = new Track.Categories(
				cvIDsStr.split('-').map((cvID) => +cvID),
				tagIDsStr.split('-').map((tagID) => +tagID),
				seriesIDsStr ? seriesIDsStr.split('-').map((seriesID) => +seriesID) : []
			);

			const resource = new Track.Resource(
				decompressURL(thumbnail),
				images ? images.split(',').map((url) => decompressURL(url)) : [],
				audios ? audios.split(',').map((url) => decompressURL(url)) : []
			).checkURLError(CHECK_URL);

			const otherLinks = additional
				? additional.split(',').map((part) => {
						const [label, url] = part.split('::');
						return new OtherLink(label, url).checkURLError(CHECK_URL);
				  })
				: [];

			const track = new Track(info, categories, resource, otherLinks);
			this.tracks.set(code, track);
			this.codeMap.set(RJcode, code);
		});
	}

	export() {
		return new DataAccessor(this);
	}
}

export class DataAccessor {
	/**
	 * @param {Database} database
	 */
	constructor(database) {
		/**@type {Database} */
		this.database = database;
		this.sortBy('upload-order', 'asc');
	}

	/**
	 * @param {'code' | 'rj-code' | 'upload-order'} type
	 * @param {'asc' | 'desc'} order
	 * @returns {number[]}
	 */
	sortBy(type, order) {
		let keyList;

		switch (type) {
			case 'code':
				keyList = [...this.database.tracks.keys()].sort((a, b) => a - b);
				break;
			case 'rj-code':
				keyList = [...this.database.codeMap.keys()]
					.sort((a, b) => {
						const [nA, nB] = [a, b].map((rjCode) => rjCode.replace('RJ', ''));
						return nA.length - nB.length || Number(nA) - Number(nB);
					})
					.map((rjCode) => this.database.codeMap.get(rjCode));
				break;
			case 'upload-order':
				keyList = [...this.database.tracks.keys()];
				break;
		}

		this.database.keyList = order === 'asc' ? keyList.reverse() : keyList;
	}

	/**
	 * @param {number} currentPage
	 * @param {number} pagePerGroup
	 * @param {number} limitPage
	 */
	getGroupOfPagination(currentPage, pagePerGroup, limitPage) {
		// Giới hạn `pagePerGroup` không vượt quá `limitPage`
		pagePerGroup = Math.min(pagePerGroup, limitPage);

		// Tính toán phạm vi startPage - endPage
		let startPage = Math.max(1, currentPage - Math.floor((pagePerGroup - 1) / 2));
		let endPage = startPage + pagePerGroup - 1;

		// Điều chỉnh khi `endPage` vượt quá `limitPage`
		if (endPage > limitPage) {
			endPage = limitPage;
			startPage = Math.max(1, endPage - pagePerGroup + 1);
		}

		// Trả về mảng số trang
		return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
	}

	/**
	 * @param {number} page
	 * @param {number} trackPerPage
	 */
	getTracksKeyForPage(page, trackPerPage, keyList = this.database.keyList) {
		const start = (page - 1) * trackPerPage;
		const end = Math.min(start + trackPerPage - 1, keyList.length);
		return keyList.slice(start, end + 1);
	}

	/**
	 * @param {number | `RJ${number}`} codeOrRJcode
	 */
	getTrackByID(codeOrRJcode) {
		return (
			this.database.tracks.get(codeOrRJcode) ??
			this.database.tracks.get(Number(codeOrRJcode)) ??
			this.database.tracks.get(this.database.codeMap.get(codeOrRJcode))
		);
	}

	/**
	 * @param {string | number} keyword
	 * @param {number[]} keyList
	 * @returns {number[]}
	 */
	searchTracksKey(keyword, keyList = this.database.keyList) {
		const lowerCaseKeyword = keyword.toString().toLowerCase();
		const keyResults = [];

		// Find Tracks with code, name or rjCode containing keywords
		keyList.forEach((key) => {
			const track = this.getTrackByID(key);
			if (!track) return;

			let {
				info: { code, RJcode, eName, jName },
				category: { cvIDs, tagIDs, seriesIDs },
			} = track;

			// Standardized data
			code = code.toString();
			[RJcode, eName, jName] = [RJcode, eName, jName].map((str) => str.toLowerCase());

			// Find Tracks with code, names or rjCode containing keywords
			if ([code, RJcode, eName, jName].some((propToCheck) => propToCheck.includes(lowerCaseKeyword)))
				keyResults.push(key);

			// Find Tracks with CVs, tag or series contain keywords
			checkCategory(cvIDs, this.database.cvs);
			checkCategory(tagIDs, this.database.tags);
			checkCategory(seriesIDs, this.database.series);
		});

		/**
		 * @template {Category<'cv' | 'tag' | 'series'>} CategoryType
		 * @param {number[]} IDs
		 * @param {Map<number, CategoryType>} categoryMap
		 */
		function checkCategory(IDs, categoryMap) {
			if (
				!keyResults.includes(key) &&
				IDs.some((id) => {
					const category = categoryMap.get(id);
					return category && category.name.toLowerCase().includes(lowerCaseKeyword);
				})
			)
				keyResults.push(key);
		}

		return keyResults;
	}

	/**
	 * @param {string} keyword
	 * @returns {SearchSuggestion<'code' | 'RJcode' | 'cv' | 'tag' | 'series' | 'eName' | 'jName'>[]}
	 */
	getSearchSuggestions(keyword) {
		const lowerCaseKeyword = keyword.toLowerCase();
		const suggestions = [];
		const seen = new Set();

		this.database.keyList.forEach((key) => {
			const track = this.database.tracks.get(key);
			if (!track) return;

			const { code, RJcode, jName, eName } = track.info;
			const { cvIDs, tagIDs, seriesIDs } = track.category;

			checkInfor('code', code.toString());
			checkInfor('RJcode', RJcode);
			checkInfor('eName', eName);
			checkInfor('jName', jName);
			checkCategory('cv', cvIDs, this.database.cvs);
			checkCategory('tag', tagIDs, this.database.tags);
			checkCategory('series', seriesIDs, this.database.series);

			/**
			 * @param {keyof typeof track.info} type
			 * @param {string} standardizedProp
			 */
			function checkInfor(type, standardizedProp) {
				const setKey = `${type}::${standardizedProp}`;
				if (!seen.has(setKey) && standardizedProp.toLowerCase().includes(lowerCaseKeyword)) {
					suggestions.push(new SearchSuggestion(type, track.info[type], keyword, code));
					seen.add(setKey);
				}
			}

			/**
			 * @template {'cv' | 'tag' | 'series'} Type
			 * @param {Type} type
			 * @param {number[]} IDs
			 * @param {Map<number, Category<Type>>} categoryMap
			 */
			function checkCategory(type, IDs, categoryMap) {
				IDs.forEach((id) => {
					const setKey = `${type}::${id}`;
					const value = categoryMap.get(id).name;
					if (!seen.has(setKey) && value.toLowerCase().includes(lowerCaseKeyword)) {
						suggestions.push(new SearchSuggestion(type, value, keyword, id));
						seen.add(setKey);
					}
				});
			}
		});

		suggestions.sort(sort.bySuggestionRelevance);
		return suggestions;
	}
}

/**
 * @param {string} rawCSV
 * @returns {{
 *      cv: string,
 *      series: string,
 *      tag: string,
 *      tracks: string,
 *      url_prefix: string
 * }}
 */
function parseRawCSV(rawCSV) {
	const sections = {};
	let currentSection = null;
	let currentData = [];

	// Đọc từng dòng và xử lý
	rawCSV.split('\n').forEach((line) => {
		const trimmedLine = line.trim();

		if (trimmedLine.startsWith('##')) {
			// Nếu gặp header phần mới, lưu phần hiện tại (nếu có)
			if (currentSection && currentData.length > 0) {
				sections[currentSection] = currentData.join('\n');
			}
			// Bắt đầu phần mới
			currentSection = trimmedLine.replaceAll('##', '').replaceAll('-', '').toLowerCase(); // Tên phần viết thường
			currentData = [];
		} else if (trimmedLine) {
			// Bỏ qua các dòng comment hoặc dòng rỗng, lưu dòng dữ liệu thô
			currentData.push(trimmedLine);
		}
	});

	// Lưu phần cuối cùng vào sections
	if (currentSection && currentData.length > 0) {
		sections[currentSection] = currentData.join('\n');
	}

	return sections;
}

/**
 * @param {string} line
 * @returns {[string, string, string, string, string, string, string, string, string, string, '${string}::${string}' | '']}
 */
function parseTrackLine(line) {
	const values = [];
	let current = '';
	let insideQuotes = false;

	for (const char of line) {
		if (char === '"') {
			insideQuotes = !insideQuotes;
		} else if (char === ',' && !insideQuotes) {
			values.push(current.trim());
			current = '';
		} else {
			current += char;
		}
	}

	// Thêm phần cuối cùng vào mảng
	current.trim().length !== 0 && values.push(current.trim());

	return values;
}
