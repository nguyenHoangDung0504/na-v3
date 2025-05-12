export default function createViewBinding(viewMap) {
	if (typeof viewMap !== 'object' || viewMap === null) {
		throw new Error("--> [createViewBinding] Error, the 'viewMap' parameter must be a valid object.");
	}

	return {
		bind(target = document) {
			if (!(target instanceof HTMLElement || target instanceof Document)) {
				throw new Error(
					"--> [createViewBinding.result.bind] Error, the 'target' parameter must be an instance of HTMLElement or Document."
				);
			}

			const selectorEntries = Object.entries(viewMap).map(([key, selectorDef]) => {
				const match = selectorDef.match(/^(.*?)(?:\s+as\s+(\w+)?(\[\])?)?$/);
				if (!match) {
					throw new Error(
						`--> [createViewBinding.result.bind] Error, at key: "${key}" in 'viewMap' defined, there is an invalid selector: ${selectorDef}`
					);
				}
				const [_, selector, tagName, isList] = match;
				return { key, selector, tagName, isList: Boolean(isList) };
			});

			const bindings = {};

			const performBinding = () => {
				selectorEntries.forEach(({ key, selector, tagName, isList }) => {
					bindings[key] = queryElements(target, selector, tagName, isList);
				});
			};

			performBinding();

			// Returns a Proxy to get the property in `bindings`
			return new Proxy(
				{},
				{
					get(_, prop) {
						if (prop === 'rebind') return performBinding;
						return bindings[prop];
					},
				}
			);
		},
	};
}

/**
 * Utility function to query HTML elements in `target` according to selectors defined in `viewMap`.
 * @param {HTMLElement | Document} target
 * @param {string} selector
 * @returns {HTMLElement | HTMLElement[] | null}
 */
function queryElements(target, selector, expectedTag, isList) {
	try {
		if (isList) {
			const elements = Array.from(target.querySelectorAll(selector));
			if (expectedTag) {
				return elements.filter((el) => el.tagName.toLowerCase() === expectedTag);
			}
			return elements;
		} else {
			const el = target.querySelector(selector);
			if (expectedTag && el && el.tagName.toLowerCase() !== expectedTag) {
				throw new Error(
					`--> [createViewBinding.queryElements] Executing querySelector("${selector}") results in <${el.tagName.toLowerCase()}> tag, which does not match the expected tag <${expectedTag}>.`
				);
			}
			return el;
		}
	} catch (error) {
		throw new Error(
			`--> [createViewBinding.queryElements] Error, error when querying selector "${selector}": ${error.message}`
		);
	}
}
