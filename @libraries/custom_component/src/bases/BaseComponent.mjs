/**
 * Abstract base class for components.
 *
 * Extend this class to create components that use Light DOM instead of Shadow DOM.
 *
 * **Important:**
 * - **Avoid querying or manipulating the DOM in the constructor.**
 *   The component may not be fully rendered or added to the DOM when the constructor is called. DOM manipulation should occur in the `connectedCallback` method, which is triggered when the component is added to the document and its styles have been applied.
 *
 * - **Custom `innerHTML` freely in the class if no `body` is passed to `defineLightDOMComponent`**:
 *   If you do not provide a `body` when defining the component using `defineLightDOMComponent`, you are free to customize the `innerHTML` of the component directly within the class constructor. This allows you to build the component's content dynamically without needing to rely on external templates.
 *
 * - **Do not modify `innerHTML` in the constructor if `body` is provided**:
 *   If you pass a `body` in the `defineLightDOMComponent` options, the component's content will be set using that `body`, and it should not be modified in the constructor to avoid confusion or conflicts with the passed content.
 *
 * **Override lifecycle methods as needed:**
 * - `connectedCallback`: Called when the element is inserted into the DOM (best place to interact with the DOM).
 * - `disconnectedCallback`: Called when the element is removed from the DOM.
 * - `attributeChangedCallback`: Called when an observed attribute has been added, removed, or updated.
 * - `adoptedCallback`: Called when the element is adopted into a new document.
 */
export default class BaseComponent extends HTMLElement {
	/**
	 * @static
	 * @virtual
	 */
	static DEBUG_MOD = false;

	/**
	 * Called when the element is inserted into the DOM.
	 * Styles are already calculated and applied.
	 *
	 * @virtual
	 */
	connectedCallback() {}

	/**
	 * Called when the element is removed from the DOM.
	 *
	 * @virtual
	 */
	disconnectedCallback() {}

	/**
	 * Called when an observed attribute has been added, removed, updated, or replaced.
	 *
	 * @virtual
	 * @param {string} name - The name of the changed attribute.
	 * @param {string | null} oldVal - The previous value of the attribute.
	 * @param {string | null} newVal - The new value of the attribute.
	 */
	attributeChangedCallback(name, oldVal, newVal) {}

	/**
	 * Called when the element is adopted into a new document.
	 *
	 * @virtual
	 */
	adoptedCallback() {}
}
