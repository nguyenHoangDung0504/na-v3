export { queryAllComponents, queryComponent };

/**
 * Retrieves a component from the DOM, optionally allowing null results.
 *
 * @template {HTMLElement} T
 * @template {boolean} [Nullable=false]
 * @param {Document | HTMLElement} root - The root element (document or HTMLElement) to query.
 * @param {new (...args: any[]) => T} ComponentClass - The class of the component to query.
 * @param {{
 * 		selector?: string,
 * 		nullable?: Nullable
 * }} options - Options for querying the component.
 * @returns {Nullable extends true ? (T | null) : T} The component if found, or null if nullable is true and not found.
 * @throws {Error} If the component is not found and nullable is false.
 */
function queryComponent(root, ComponentClass, options = { selector: '', nullable: false }) {
	const { selector, nullable } = options;
	const result = root.querySelector(ComponentClass.COMPONENT_NAME + selector);

	if (!nullable && result === null) {
		throw new Error(`The required component '${ComponentClass.COMPONENT_NAME}' was not found in the DOM.`);
	}

	return result;
}

/**
 * Retrieves all components of a given class from the DOM.
 *
 * @template {HTMLElement} T
 * @param {Document | HTMLElement} root - The root element (document or HTMLElement) to query.
 * @param {new (...args: any[]) => T} ComponentClass - The class of the components to query.
 * @param {string} selector - The CSS selector to query the components. Leave empty to query only by tag name.
 * @returns {NodeListOf<T>} A NodeList of all matching components.
 */
function queryAllComponents(root, ComponentClass, selector) {
	return root.querySelectorAll(ComponentClass.TAG_NAME + selector);
}
