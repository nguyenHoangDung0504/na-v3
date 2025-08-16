export default class PrefixStorage {
	/** @type {Map<number, string>} */
	_atoms = new Map();

	/** @type {Map<number, string>} */
	_prefixExpr = new Map();

	/** @type {Promise<void>} */
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
		lines.shift(); // bỏ dòng header

		for (const line of lines) {
			const parts = line.split(',');
			if (parts[0] === 'A') {
				// Atom
				const id = Number(parts[1]);
				this._atoms.set(id, parts[2]);
			} else {
				// Prefix
				const id = Number(parts[0]);
				this._prefixExpr.set(id, parts[1]);
			}
		}
	}

	/**
	 * @private
	 * @param {string} expr
	 * @returns {string}
	 */
	_resolveExpression(expr) {
		return expr
			.split('>')
			.map((token) => {
				const n = Number(token);
				if (!Number.isNaN(n) && this._atoms.has(n)) {
					return this._atoms.get(n); // thay bằng atom
				}
				return token; // phần text thô
			})
			.join('');
	}

	/**
	 * Lấy prefix đầy đủ theo ID (không cache)
	 * @param {number} id
	 * @returns {Promise<string | undefined>}
	 */
	async get(id) {
		await this._pending;

		if (!this._prefixExpr.has(id)) {
			return undefined;
		}

		const expr = this._prefixExpr.get(id);
		return this._resolveExpression(expr);
	}

	/**
	 * Lấy nhiều prefix theo danh sách ID (không cache)
	 * @param {number[]} IDs
	 * @returns {Promise<(string | undefined)[]>}
	 */
	async getAll(IDs) {
		await this._pending;
		return Promise.all(IDs.map((id) => this.get(id)));
	}
}
