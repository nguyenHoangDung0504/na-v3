export default function createViewBinding(viewMap) {
	if (typeof viewMap !== 'object' || viewMap === null) {
		throw new Error(
			"--> [createViewBinding]: Error, 'viewMap' must be a valid object."
		);
	}

	return {
		/**
		 * Binds elements based on `viewMap` selectors.
		 * @param {HTMLElement | Document} [target=document] - Root element to query from
		 * @returns {ViewBinding<ViewMap>}
		 */
		bind(target = document) {
			if (!(target instanceof HTMLElement || target instanceof Document)) {
				throw new Error(
					"--> [createViewBinding.returnValue.bind]: Error, 'target' must be an instance of HTMLElement or Document."
				);
			}

			const bindings = {};

			const performBinding = () => {
				for (const [key, selectorDef] of Object.entries(viewMap)) {
					const match = /^(.*?)(?:\s+as\s+(\w+)?(\[\])?)?$/.exec(selectorDef);
					if (!match)
						throw new Error(
							`--> [createViewBinding.returnValue.bind]: Error, invalid selector for key "${key}": ${selectorDef}`
						);

					const [_, selector, tagName, isList] = match;
					bindings[key] = queryElements(
						target,
						selector,
						tagName,
						Boolean(isList)
					);
				}
			};

			performBinding();

			// Returns a Proxy to dynamically get the bound elements
			return new Proxy(bindings, {
				get(_, prop) {
					if (prop === 'rebind') return performBinding;
					else if (prop === 'root') return target;
					return bindings[prop];
				},
			});
		},
	};
}

/**
 * Queries elements based on selector and optional tag filter.
 * @param {HTMLElement | Document} target - Root to query within
 * @param {string} selector - CSS selector
 * @param {string | undefined} expectedTag - Expected tag name (optional)
 * @param {boolean} isList - Whether the selector is an array
 * @returns {HTMLElement | HTMLElement[] | null}
 */
function queryElements(target, selector, expectedTag, isList) {
	try {
		if (isList) {
			const elements = [...target.querySelectorAll(selector)];
			return expectedTag
				? elements.filter((el) => el.tagName.toLowerCase() === expectedTag)
				: elements;
		} else {
			const el = target.querySelector(selector);
			if (expectedTag && el && el.tagName.toLowerCase() !== expectedTag) {
				throw new Error(
					`--> [createViewBinding.queryElements]: Error, expected <${expectedTag}>, but found <${el.tagName.toLowerCase()}>.`
				);
			}
			return el;
		}
	} catch (error) {
		throw new Error(
			`--> [createViewBinding.queryElements]: Error, failed to query "${selector}": ${error.message}`
		);
	}
}
