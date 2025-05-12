import BaseComponent from './BaseComponent.mjs';

/**
 * @extends {BaseComponent}
 * @classdesc
 * `RenderableComponent` is a base class for components that can re-render their inner HTML content
 * based on attribute values. When extending this class, you **must call** `super.connectedCallback()` if you override these methods.
 * Failing to do so will prevent the rendering logic from functioning correctly.
 *
 * **How it works:**
 * - When the component is attached to the DOM (`connectedCallback`), its initial HTML template is stored.
 * - Each time an observed attribute changes (`attributeChangedCallback`), the content is re-rendered
 *   with the latest attribute values replacing placeholders in the form of `@render:attribute-name`.
 *
 * **Example of Attribute Placeholder:**
 * HTML: `<div>@render:title</div>`
 * Rendered Output: `<div>Hello World</div>`
 */
export default class RenderableComponent extends BaseComponent {
	/**
	 * Prefix for attribute placeholders used in the template.
	 * You can change this value as needed.
	 */
	static ATTRIBUTE_PLACEHOLDER_PREFIX = '@render';

	/**
	 * @private
	 * @type {boolean}
	 * Marks the first rendering.
	 */
	_firstTimeRender = true;

	/**
	 * @private
	 * @type {string | undefined}
	 * Holds the initial HTML template.
	 */
	_templateHTML = undefined;

	/**
	 * - Called when the element is inserted into the DOM.
	 * - **You must call:** `super.connectedCallback()` if you override this method.
	 *
	 * @virtual
	 * @override
	 */
	connectedCallback() {
		if (this._firstTimeRender) {
			this._firstTimeRender = false;
			// Store the initial HTML template
			this._templateHTML = this.innerHTML;

			if (this.constructor.DEBUG_MOD) {
				console.log(
					`** Debug for component "${this.constructor.COMPONENT_NAME}":`
				);
				console.log(
					`** On: ${this.constructor.COMPONENT_NAME}.connectedCallback`
				);
				console.log('Saved Template HTML:', this._templateHTML);
				console.log('\n');
			}
		}
	}

	/**
	 * Renders the component's HTML content based on attribute placeholders.
	 */
	render() {
		if (!this._templateHTML) return;

		// Clone the original template to prevent overwriting it
		let renderedHTML = this._templateHTML;

		const placeholderPrefix = this.constructor.ATTRIBUTE_PLACEHOLDER_PREFIX;

		// Tạo regex thông qua RegExp constructor để chấp nhận giá trị biến
		const regex = new RegExp(
			`${placeholderPrefix}:([a-zA-Z0-9_\\-]+(?:\\.[a-zA-Z0-9_\\-]+)*)`,
			'g'
		);

		if (
			!this._templateHTML ||
			typeof this.model !== 'object' ||
			this.model === null
		) {
			console.error('Invalid model:', this.model);
			return;
		}

		// Replace all placeholders
		renderedHTML = this._templateHTML.replace(regex, (_, key) => {
			const value = key.split('.').reduce((acc, k) => acc?.[k], this.model);
			console.log(key);
			return (
				value ??
				(this.constructor.DEBUG_MOD
					? `Require-debug: key::\`${key}\` not found in model`
					: '')
			);
		});

		// Update the inner HTML
		this.innerHTML = renderedHTML;

		if (this.constructor.DEBUG_MOD) {
			console.log(
				`** Debug for component "${this.constructor.COMPONENT_NAME}":`
			);
			console.log(`** On: ${this.constructor.COMPONENT_NAME}.render`);
			console.log('Rendered HTML:', renderedHTML);
			console.log('\n');
		}
	}

	/**
	 * Applies a given model to the component by mapping object properties to attributes.
	 * This allows the component to reflect property values as HTML attributes.
	 * Render it self again.
	 *
	 * @template T
	 * @param {T} model - An object representing key-value pairs to map as attributes.
	 * @throws {Error} If the key name is not valid for attribute transformation.
	 */
	applyModel(model) {
		/**@type {T} */
		this.model = model;
	}
}
