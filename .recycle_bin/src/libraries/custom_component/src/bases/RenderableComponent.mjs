import BaseComponent from './BaseComponent.mjs';

/**
 * @extends {BaseComponent}
 * @classdesc
 * `RenderableComponent` is a base class for components that can re-render their inner HTML content
 * based on attribute values. When extending this class, you **must call** `super.connectedCallback()`
 * and `super.attributeChangedCallback()` if you override these methods.
 * Failing to do so will prevent the rendering logic from functioning correctly.
 *
 * **How it works:**
 * - When the component is attached to the DOM (`connectedCallback`), its initial HTML template is stored.
 * - Each time an observed attribute changes (`attributeChangedCallback`), the content is re-rendered
 *   with the latest attribute values replacing placeholders in the form of `@render:attribute-name`.
 *
 * **Example of Attribute Placeholder:**
 * HTML: `<div>@render:title</div>`
 * JavaScript: `element.setAttribute('title', 'Hello World')`
 * Rendered Output: `<div>Hello World</div>`
 */
export default class RenderableComponent extends BaseComponent {
	/**
	 * Prefix for all attributes to avoid conflicts.
	 * You can change this value as needed.
	 */
	static PREFIX_ATTRIBUTE = 'render_key:';

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
				console.log(`** Debug for component "${this.constructor.COMPONENT_NAME}":`);
				console.log(`** On: ${this.constructor.COMPONENT_NAME}.connectedCallback`);
				console.log('Saved Template HTML:', this._templateHTML);
				console.log('\n');
			}
		}
	}

	/**
	 * @protected
	 * Renders the component's HTML content based on attribute placeholders.
	 */
	render() {
		if (!this._templateHTML) return;

		// Clone the original template to prevent overwriting it
		let renderedHTML = this._templateHTML;

		const prefix = this.constructor.PREFIX_ATTRIBUTE;
		const placeholderPrefix = this.constructor.ATTRIBUTE_PLACEHOLDER_PREFIX;

		// Tạo regex thông qua RegExp constructor để chấp nhận giá trị biến
		const regex = new RegExp(`${placeholderPrefix}:([a-zA-Z0-9-_]+)`, 'g');

		// Replace all placeholders
		renderedHTML = renderedHTML.replace(regex, (_, key) => {
			const prefixedKey = `${prefix}${key}`;
			return (
				this.getAttribute(prefixedKey) || (this.constructor.DEBUG_MOD ? `@require-debug:${prefixedKey} not found` : '')
			);
		});

		// Update the inner HTML
		this.innerHTML = renderedHTML;

		if (this.constructor.DEBUG_MOD) {
			console.log(`** Debug for component "${this.constructor.COMPONENT_NAME}":`);
			console.log(`** On: ${this.constructor.COMPONENT_NAME}._render`);
			console.log('Rendered HTML:', renderedHTML);
			console.log('\n');
		}
	}

	/**
	 * Applies a given model to the component by mapping object properties to attributes.
	 * This allows the component to reflect property values as HTML attributes.
	 * Render it self again.
	 *
	 * @param {Object} model - An object representing key-value pairs to map as attributes.
	 * @throws {Error} If the key name is not valid for attribute transformation.
	 */
	applyModel(model) {
		const prefix = this.constructor.PREFIX_ATTRIBUTE;

		// Regex pattern to detect camelCase to kebab-case transitions
		const attributePattern = /(?<=[a-z])(?=[A-Z])/g;

		// Collect attributes to observe
		const observedAttributes = [];

		for (const [key, value] of Object.entries(model)) {
			// Convert camelCase to kebab-case
			const attributeName = key.replace(attributePattern, '-').toLowerCase();

			// Check if the conversion is valid
			if (!attributeName.includes('-') && attributeName !== key.toLowerCase()) {
				throw new Error(
					`Invalid attribute name "${key}". It must contain at least one transition between lowercase and uppercase.`
				);
			}

			// Apply attribute to the element
			this.setAttribute(prefix + attributeName, value);

			// Collect it for observation
			observedAttributes.push(prefix + attributeName);
		}

		this.render();
	}
}
