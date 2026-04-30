import { B64_MAP, fromB64 } from './utils.mjs'

export default class PrefixStorage {
	/** @type {Map<number, string>} */
	_atoms = new Map()

	/** @type {Map<number, string>} */
	_prefixExpr = new Map()

	/** @type {Promise<void>} */
	_pending

	/**
	 * @param {string} resourcePath
	 */
	constructor(resourcePath) {
		this._pending = fetch(resourcePath + 'prefix.csv')
			.then((res) => res.text())
			.then((rawCSV) => this._parseRawCSV(rawCSV))
	}

	/**
	 * @private
	 * @param {string} rawCSV
	 */
	_parseRawCSV(rawCSV) {
		const lines = rawCSV.trim().split('\n')
		lines.shift() // bỏ dòng header

		for (const line of lines) {
			const parts = line.split(',')
			if (parts[0] === 'A') {
				// Atom: "A,<b64id>,<text>"
				const id = fromB64(parts[1])
				this._atoms.set(id, parts[2])
			} else {
				// Prefix composition: "<b64id>,<expression>"
				const id = fromB64(parts[0])
				this._prefixExpr.set(id, parts[1])
			}
		}
	}

	/**
	 * Giải mã expression chứa atom refs dạng "<b64id>>"
	 * Ví dụ: "1>rest" với atom 1 = "https://" → "https://rest"
	 * @private
	 * @param {string} expr
	 * @returns {string}
	 */
	_resolveExpression(expr) {
		// Tách tại ">" — mỗi token trước ">" là atom ref (base64), token cuối là literal
		return expr
			.split('>')
			.map((token) => {
				if (token === '') return '' // trailing ">" hoặc liên tiếp
				// Kiểm tra toàn bộ token có phải base64 ID không
				if ([...token].every((c) => B64_MAP[c] !== undefined)) {
					const id = fromB64(token)
					if (this._atoms.has(id)) {
						return this._atoms.get(id) // thay atom
					}
				}
				return token // phần text thô
			})
			.join('')
	}

	/**
	 * Lấy prefix đầy đủ theo base64 ID string hoặc số nguyên
	 * @param {number | string} id  — số nguyên hoặc chuỗi base64
	 * @returns {Promise<string | undefined>}
	 */
	async get(id) {
		await this._pending
		const numericId = typeof id === 'string' ? fromB64(id) : id

		if (!this._prefixExpr.has(numericId)) {
			return undefined
		}

		const expr = this._prefixExpr.get(numericId)
		return this._resolveExpression(expr)
	}

	/**
	 * Lấy nhiều prefix theo danh sách ID (số hoặc base64 string)
	 * @param {(number | string)[]} IDs
	 * @returns {Promise<(string | undefined)[]>}
	 */
	async getAll(IDs) {
		await this._pending
		return Promise.all(IDs.map((id) => this.get(id)))
	}
}
