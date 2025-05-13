/**
 * @template T
 */
export default class ListView {
	/**
	 * @template ModelType
	 * @typedef {(container: HTMLElement, data: T[]) => void} ListEventHandler
	 */

	/**
	 * @template ModelType
	 * @typedef {(item: HTMLElement, data: T, index: number) => void} ItemEventHandler
	 */

	/**
	 * @template ModelType
	 * @typedef {{
	 * 		'before-render': ListEventHandler<ModelType>
	 * 		'after-render': ListEventHandler<ModelType>
	 * 		'before-item-added': ItemEventHandler<ModelType>
	 * 		'after-item-added': ItemEventHandler<ModelType>
	 * }} ListViewEventMap
	 */

	/**
	 * @template ModelType
	 * @typedef {new (...args: any[]) => ModelType} ModelClass
	 */

	/**
	 * @template ModelType
	 * @typedef {(template: HTMLElement, data: ModelType) => void} ItemRenderer
	 */

	/**
	 * @private
	 * @type {{
	 * 		[K in keyof ListViewEventMap<T>]: ListViewEventMap<T>[K][]
	 * }}
	 */
	_eventHandlers = {
		'before-render': [],
		'after-render': [],
		'before-item-added': [],
		'after-item-added': [],
	};

	/**
	 * @private
	 * @type {WeakMap<T, HTMLElement>}
	 */
	_itemCache = new WeakMap();

	/**
	 * @private
	 * @type {T[]}
	 */
	_itemCacheKeys = [];

	/**
	 * Create new instance of ListView
	 * @param {ModelClass<T>} ModelType
	 * @param {HTMLElement} listContainer
	 * @param {ItemRenderer<T>} itemRenderer
	 */
	constructor(ModelType, listContainer, itemRenderer) {
		if (document.readyState === 'loading')
			console.warn(
				'--> [ListView.constructor]: Warning, document is still loading. Render might fail.'
			);

		/**@private */ this._ModelType = ModelType;
		/**@private */ this._container = listContainer;
		/**@private */ this._renderItem = itemRenderer;

		if (!(this._container instanceof HTMLElement))
			throw new TypeError(
				'--> [ListView.constructor]: Error, the container must be a valid instance of HTMLElement.'
			);
		if (this._container.childElementCount < 1)
			throw new Error(
				'--> [ListView.constructor]: Error, cannot not find a valid HTML template inside the container.'
			);
		if (typeof this._renderItem !== 'function')
			throw new TypeError(
				"--> [ListView.constructor]: Error, 'itemRenderer' must be a valid function."
			);

		/**@private */ this._template =
			this._container.firstElementChild?.cloneNode(true);
		this._container.innerHTML = '';
	}

	get data() {
		return this._data;
	}

	/**
	 * Update data and re-render
	 * @param {T[]} newData
	 */
	update(newData) {
		if (!Array.isArray(newData)) {
			throw new Error(
				`--> [ListView.updateData]: Error, 'newData' must be an array.`
			);
		}
		if (!newData.every((item) => item instanceof this._ModelType)) {
			throw new TypeError(
				`[ListView.updateData] Error, 'newData' contains elements that are not instances of the expected model class.`
			);
		}
		this._render(newData);
	}

	/**
	 * Add an event handler
	 * @template {keyof ListViewEventMap<T>} K
	 * @param {K} eventName
	 * @param {ListViewEventMap<T>[K]} handler
	 */
	on(eventName, handler) {
		this._eventHandlers[eventName]?.push(handler);
		return this;
	}

	/**
	 * @private
	 * @param {T[]} newData
	 */
	_render(newData = this._data) {
		this._eventHandlers['before-render'].forEach((cb) =>
			cb(this._container, newData)
		);

		const fragment = document.createDocumentFragment();
		const oldNodes = Array.from(this._container.children);

		newData.forEach((item, index) => {
			// Check cache
			let node = this._itemCache.get(item);

			// Render new node
			if (!this._itemCache.has(item)) {
				node = this._template.cloneNode(true);
				this._renderItem(node, item, index);
				this._itemCache.set(item, node);
				this._itemCacheKeys.push(item);
			}

			// Add to view and call callbacks
			this._eventHandlers['before-item-added'].forEach((cb) =>
				cb(node, item, index)
			);
			fragment.appendChild(node);
			this._eventHandlers['after-item-added'].forEach((cb) =>
				cb(node, item, index)
			);
		});

		oldNodes.forEach((node) => {
			// Duyệt qua danh sách các key đã lưu
			const boundItem = this._itemCacheKeys.find(
				(key) => this._itemCache.get(key) === node
			);
			if (boundItem && !newData.includes(boundItem)) {
				this._container.removeChild(node);
				// Có thể cập nhật lại _itemCacheKeys nếu cần: loại bỏ boundItem khỏi mảng
				this._itemCacheKeys = this._itemCacheKeys.filter(
					(key) => key !== boundItem
				);
			}
		});

		this._container.appendChild(fragment);
		/**@private */
		this._data = newData;
		this._eventHandlers['after-render'].forEach((cb) =>
			cb(this._container, this._data)
		);
	}

	/**
	 * Create itemRenderer to storage and reuse
	 * @template T
	 * @param {ModelClass<T>} ModelType
	 * @param {ItemRenderer<T>} itemRenderer
	 */
	static createItemRenderer(ModelType, itemRenderer) {
		return itemRenderer;
	}
}
