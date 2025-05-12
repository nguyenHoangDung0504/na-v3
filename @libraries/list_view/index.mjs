export default class ListView {
	// Configs
	_containerMarkerAttribute = 'lv-container';
	_templateMarkerAttribute = 'lv-template';
	_log = true;

	// Main variables
	_DataType = class {};
	_listContainer;
	_itemTemplate;
	_dataBinder = (template, data) => {};
	_dataCollection = [];

	// Hooks
	_beforeItemAdded;
	_afterItemAdded;
	_beforeRender;
	_afterRender;

	constructor(DataType, listContainer, dataBinder) {
		document.readyState === 'loading' &&
			console.warn('--> [ListView.constructor] Warning, document is in loading state');

		this._DataType = DataType;

		// Kiểm tra và thiết lập container
		this._listContainer = listContainer;
		if (!(listContainer instanceof HTMLElement)) {
			throw new TypeError('--> [ListView.constructor] Error, the container must be a valid instance of HTMLElement.');
		}

		// Kiểm tra thuộc tính container
		if (!listContainer.hasAttribute(this._containerMarkerAttribute)) {
			console.error(
				'--> [ListView.constructor] Log debug: The container element has no attribute to mark it as a container.',
				this._listContainer
			);
			throw new Error(
				`--> [ListView.constructor] Error, ListView's container must be marked with the '${this._containerMarkerAttribute}' attribute.`
			);
		}

		// Kiểm tra số lượng phần tử con trong container
		if (listContainer.childElementCount > 1) {
			this._log &&
				console.warn(
					`--> [ListView.constructor] Warning, in a given container with many child elements, the ListView only takes the first element as its template.
					Review the container if necessary:`,
					listContainer
				);
		}

		// Kiểm tra mẫu HTML
		this._itemTemplate = this._listContainer.firstElementChild?.cloneNode(true);
		if (!this._itemTemplate) {
			throw new Error('--> [ListView.constructor] Error, could not find a valid HTML template inside the container.');
		}

		// Kiểm tra thuộc tính template
		if (!this._listContainer.firstElementChild.hasAttribute(this._templateMarkerAttribute)) {
			this._log &&
				console.error(
					'--> [ListView.constructor] Log debug: The template element has no attribute to mark it as a template.',
					this._listContainer.firstElementChild
				);
			throw new Error(
				`--> [ListView.constructor] Error, elements used as templates must be marked with the '${this._templateMarkerAttribute}' attribute.`
			);
		}

		// Kiểm tra dataBinder
		if (typeof dataBinder !== 'function') {
			throw new Error("--> [ListView.constructor] Error, 'dataBinder' must be a valid function.");
		}

		this._dataBinder = dataBinder;

		// Xóa nội dung template khỏi container
		this._itemTemplate.removeAttribute(this._templateMarkerAttribute);
		this._listContainer.innerHTML = '';
	}

	config({ log, containerMarkerAttribute, templateMarkerAttribute }) {
		this._log = log;
		this._containerMarkerAttribute = containerMarkerAttribute;
		this._templateMarkerAttribute = templateMarkerAttribute;
		return this;
	}

	setDataCollection(dataCollection) {
		if (!Array.isArray(dataCollection)) {
			this._log &&
				console.error(
					'--> [ListView.setDataCollection] Log debug: The data set type is invalid. An array required',
					dataCollection
				);
			throw new Error(
				`--> [ListView.setDataCollection] Error, the data collection must be an array containing elements of type '${this._DataType.name}'.`
			);
		}
		this._dataCollection = dataCollection;
		this.render();
	}

	beforeItemAddedCall(callback) {
		this._beforeItemAdded = callback;
		return this;
	}

	afterItemAddedCall(callback) {
		this._afterItemAdded = callback;
		return this;
	}

	beforeRenderCall(callback) {
		this._beforeRender = callback;
		return this;
	}

	afterRenderCall(callback) {
		this._afterRender = callback;
		return this;
	}

	render() {
		let addedNodes = [];

		if (!this._dataBinder) {
			throw new Error("--> [ListView.render] Error, 'dataBinder' needs to be set before calling 'render'.");
		}

		if (this._beforeRender) this._beforeRender(this._listContainer, this._dataCollection);

		// Làm rỗng container trước khi render
		this._listContainer.innerHTML = '';

		this._dataCollection.forEach((data, index) => {
			if (!(data instanceof this._DataType)) {
				this._log &&
					console.error(`--> [ListView.render] Log debug: Element has invalid type at index ${index}.`, data);
				throw new Error(
					`--> [ListView.render] Error, the element at index ${index} is not an instance of class '${this._DataType.name}'.`
				);
			}

			const root = this._itemTemplate.cloneNode(true);
			addedNodes.push(root);

			// Tạo binder và xử lý binding
			this._dataBinder(root, data);

			// Gọi hook trước khi thêm phần tử
			if (this._beforeItemAdded) this._beforeItemAdded(root, data);

			// Thêm phần tử vào container
			this._listContainer.appendChild(root);

			// Gọi hook sau khi thêm phần tử
			if (this._afterItemAdded) this._afterItemAdded(root, data);
		});

		if (this._afterRender) this._afterRender(this._listContainer, this._dataCollection, addedNodes);
	}

	static createConfig({ log, containerMarkerAttribute, templateMarkerAttribute }) {
		return { log, containerMarkerAttribute, templateMarkerAttribute };
	}

	static createDataBinder(DataType, bindFunction) {
		return (binding, data) => {
			if (!(data instanceof DataType)) {
				throw new Error(
					`--> [ListView.createDataBinder.bindFunction] Error, the input data must be an instance of class '${DataType.name}'.`
				);
			}
			bindFunction(binding, data);
		};
	}
}
