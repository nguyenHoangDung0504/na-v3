import BaseComponent from "./bases/BaseComponent.mjs";

export { defineLightDOMComponent };

/**
 * Defines a new Light DOM component and registers it with the custom element registry.
 *
 * @template {string} TagName
 * @template {typeof BaseComponent} PrototypeComponentClass
 * @param {TagName} tagName
 * @param {{
 * 		Prototype?: PrototypeComponentClass
 * 		body?: string
 * 		style?: string
 * }} options
 * @returns {PrototypeComponentClass & { TAG_NAME: TagName }}
 */
function defineLightDOMComponent(tagName, { Prototype = BaseComponent, body, style }) {
	if (customElements.get(tagName)) {
		console.warn(`Element name:${tagName} has been defined, ignore.`);
		return;
	}

	if (typeof Prototype !== 'function') {
		throw new TypeError(`Invalid 'Prototype' provided for component '${tagName}'`);
	}

	if (!isSubclassOf(Prototype, HTMLElement)) {
		throw new Error(`The 'Prototype' class (${Prototype.name}) must extend HTMLElement`);
	}

	const ComponentClass = class extends Prototype {
		static COMPONENT_NAME = tagName;

		template = document.createElement('template');

		connectedCallback() {
			if (this.constructor.DEBUG_MOD) {
				console.log(`** Debug for component "${this.constructor.COMPONENT_NAME}":`);
				console.log(`** On: ${this.constructor.COMPONENT_NAME}.connectedCallback`);
				console.log(this);
				console.log('\n');
			}

			if (style && !document.getElementById(`style-component:${tagName}`)) {
				document.head.appendChild(
					Object.assign(document.createElement('style'), {
						id: `style-component:${tagName}`,
						innerHTML: style.replaceAll(':self', tagName),
					})
				);
			}

			if (body) {
				this.appendChild(Object.assign(this.template, { innerHTML: body }).content.cloneNode(true));
			}

			// If Prototype has connectedCallback, call
			super.connectedCallback?.();
		}
	};

	customElements.define(tagName, ComponentClass);
	return ComponentClass;
}

/**
 * Checks if a class is a subclass of another class.
 *
 * @param {Function} subclass - The class to check.
 * @param {Function} superclass - The class to check against.
 * @returns {boolean} True if subclass is a subclass of superclass, otherwise false.
 */
function isSubclassOf(subclass, superclass) {
	let proto = subclass.prototype;
	while (proto) {
		if (proto === superclass.prototype) return true;
		proto = Object.getPrototypeOf(proto);
	}
	return false;
}
