import { AddtionalURL, Resource, Track, TrackCategories, TrackInfo, TrackResources } from '../../app.models.mjs';
import { string } from '../../app.utils.mjs';

export default class TrackStorage {
	/**
	 * @private
	 * @type {Map<number, Track>}
	 */
	_registry = new Map();

	/**
	 * @private
	 * @type {Promise<void>}
	 */
	_pending;

	/**
	 * @private
	 * @type {Map<`RJ${number}`, number>}
	 */
	_codeMap = new Map();

	/**
	 * @private
	 * @type {number[]}
	 */
	_IDs = [];

	/**
	 * @param {string} resourcePath
	 */
	constructor(resourcePath) {
		this._pending = fetch(resourcePath + 'tracks.csv')
			.then((res) => res.text())
			.then((rawCSV) => this._parseRawCSV(rawCSV));
	}

	/**
	 * @private
	 * @param {string} rawCSV
	 */
	_parseRawCSV(rawCSV) {
		const lines = rawCSV.trim().split('\n');
		lines.shift();

		lines.forEach((line) => {
			line = parseTrackLine(line);

			const code = Number(line[0]);
			const cvIDs = line[2] ? line[2].split('-').map((id) => Number(id)) : [];
			const tagIDs = line[3] ? line[3].split('-').map((id) => Number(id)) : [];
			const seriesIDs = line[4] ? line[4].split('-').map((id) => Number(id)) : [];
			const thumbnail = new Resource(...line[7].split('->'));

			// Note: update 17/8/2025, test decodeURIComponent for compress, replace "," with "/" splitor
			const images = line[8] ? line[8].split('/').map((col) => new Resource(...col.split('->'))) : [];
			const audios = line[9] ? line[9].split('/').map((col) => new Resource(...col.split('->'))) : [];
			const additionalURLs = line[10]
				? line[10].split(',').map((col) => {
						return new AddtionalURL(...col.split('::'));
				  })
				: [];

			let [, RJcode, , , , eName, jName] = line;
			eName = string.formatQuotes(eName);
			jName = string.formatQuotes(jName);

			this._codeMap.set(RJcode, code);
			this._registry.set(
				code,
				new Track(
					new TrackInfo(code, RJcode, eName, jName),
					new TrackCategories(cvIDs, tagIDs, seriesIDs),
					new TrackResources(thumbnail, images, audios),
					additionalURLs
				)
			);
		});

		// Lấy danh sách ID để tối ưu việc sắp xếp
		this._IDs = [...this._registry.keys()].reverse();
		console.log(`--> [Database.TrackStorage]: Added ${this._IDs.length} tracks`, this._registry);
	}

	/**
	 * @param {'code' | 'rj-code'} criteria
	 * @param {'asc' | 'desc'} order
	 */
	async sortBy(criteria, order = 'asc') {
		await this._pending;

		const factor = order === 'asc' ? 1 : -1;

		if (criteria === 'code') {
			this._IDs.sort((a, b) => factor * (a - b));
		} else {
			this._IDs.sort((a, b) => {
				const itemA = this._registry.get(a).replace('RJ', '');
				const itemB = this._registry.get(b).replace('RJ', '');
				if (criteria === 'rj-code') {
					return (itemA.length - itemB.length || Number(itemA) - Number(itemB)) * factor;
				}
				return 0;
			});
		}
	}

	/**
	 * @returns {Promise<number[]>}
	 */
	async getIDs() {
		await this._pending;
		return this._IDs;
	}

	/**
	 * @param {number | `RJ${number}`} id
	 * @returns {Promise<Track | undefined>}
	 */
	async get(id) {
		await this._pending;
		return this._registry.get(id) || this._registry.get(this._codeMap.get(id));
	}

	/**
	 * @param {number[] | `RJ${number}`[]} IDs
	 * @returns {Promise<Track[]>}
	 */
	async getAll(IDs) {
		await this._pending;
		return IDs.map((id) => this._registry.get(id) || this._registry.get(this._codeMap.get(id)));
	}
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
