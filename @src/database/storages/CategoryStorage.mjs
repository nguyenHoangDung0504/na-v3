import { Category } from '../../app.models.mjs';

/**
 * @template {'cv' | 'tag' | 'series'} T
 */
export default class CategoryStorage {
	/**
	 * @private
	 * @type {Map<number, Category<T>>}
	 */
	_registry = new Map();

	/**
	 * @private
	 * @type {Promise<void>}
	 */
	_pending;

	/**
	 * @private
	 * @type {T}
	 */
	_type;

	/**
	 * @private
	 * @type {number[]}
	 */
	_IDs = [];

	/**
	 * @param {T} type
	 * @param {string} resourcePath
	 */
	constructor(type, resourcePath) {
		this._type = type;
		this._pending = fetch(resourcePath + this._type + '.csv')
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
			const [id, name, quantity] = line.split(',');
			this._registry.set(
				Number(id),
				new Category(+id, this._type, (name === 'Described' ? '*' : '') + name, Number(quantity))
			);
		});

		// Lấy danh sách ID để tối ưu việc sắp xếp
		this._IDs = [...this._registry.keys()];
	}

	/**
	 * @param {'id' | 'name' | 'quantity'} criteria
	 * @param {'asc' | 'desc'} order
	 */
	async sortBy(criteria, order = 'asc') {
		await this._pending;

		const factor = order === 'asc' ? 1 : -1;

		if (criteria === 'id') {
			this._IDs.sort((a, b) => factor * (a - b));
		} else {
			this._IDs.sort((a, b) => {
				const itemA = this._registry.get(a);
				const itemB = this._registry.get(b);
				if (criteria === 'name') {
					return factor * itemA.name.localeCompare(itemB.name);
				} else if (criteria === 'quantity') {
					return factor * (itemA.quantity - itemB.quantity);
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
	 * @param {number} id
	 * @returns {Promise<Category<T> | undefined>}
	 */
	async get(id) {
		await this._pending;
		return this._registry.get(id);
	}

	/**
	 * @param {number[]} IDs
	 * @returns {Promise<Category<T>[]>}
	 */
	async getAll(IDs) {
		await this._pending;
		return IDs.map((id) => this._registry.get(id));
	}
}
