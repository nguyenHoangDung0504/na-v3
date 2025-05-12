export default class PrefixStorage {
	/**
	 * @private
	 * @type {Map<number, string>}
	 */
	_registry = new Map();

	/**
	 * @private
	 * @type {Promise<void>}
	 */
	_pending;

	/**
	 * @param {string} resourcePath
	 */
	constructor(resourcePath) {
		this._pending = fetch(resourcePath + 'prefix.csv')
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
			const [id, prefix] = line.split(',');
			this._registry.set(Number(id), prefix);
		});
	}

	/**
	 * @param {number} id
	 * @returns {Promise<string | undefined>}
	 */
	async get(id) {
		await this._pending;
		return this._registry.get(id);
	}
}
