/**@type {import('./types.d.mts')['createViewBinding']} */
export function createViewBinding(viewMap) {
	if (typeof viewMap !== 'object' || viewMap === null) {
		throw new Error("--> [createViewBinding]: Error, 'viewMap' must be a valid object.");
	}

	return {
		viewBinding: {
			bind(target = document) {
				if (!(target instanceof HTMLElement || target instanceof Document)) {
					throw new Error(
						"--> [createViewBinding.returnValue.bind]: Error, 'target' must be an instance of HTMLElement or Document."
					);
				}

				const bindings = { _root: target };
				let elementToKeys = null;

				const register = (el, key) => {
					if (!elementToKeys.has(el)) elementToKeys.set(el, new Set());
					elementToKeys.get(el).add(key);
				};

				const isElementBoundToKey = (el, key) => elementToKeys.has(el) && elementToKeys.get(el).has(key);

				const performBinding = () => {
					elementToKeys = new WeakMap();

					for (const [key, selectorDef] of Object.entries(viewMap)) {
						const match = /^(.*?)(\?)?\s*(?:=\s*(?:(\w+))?(\[\])?)?$/.exec(selectorDef);

						if (!match) {
							throw new Error(`--> [createViewBinding]: Invalid selector for key "${key}": ${selectorDef}`);
						}

						const [, rawSelector, optionalMark, tagName, listMark] = match;

						const selector = rawSelector.trim();
						const expectedTag = tagName?.toLowerCase();
						const isRequired = !optionalMark; // mặc định là required, chỉ optional khi có ?
						const isList = Boolean(listMark);

						const result = queryElements(target, selector, expectedTag, isList);

						if (!isRequired && !isList && result === null) {
							bindings[key] = null;
						} else if (isRequired && !isList && result === null) {
							throw new Error(
								`--> [createViewBinding]: Required selector "${selectorDef}" not found for key "${key}".`
							);
						} else {
							bindings[key] = result;
							if (Array.isArray(result)) result.forEach((el) => register(el, key));
							else register(result, key);
						}
					}
				};

				performBinding();

				return new Proxy(bindings, {
					get(_, prop) {
						if (prop === '_rebind') return performBinding;
						if (prop === '_isBoundTo') return isElementBoundToKey;
						return bindings[prop];
					},
				});
			},
		},

		viewMap,
	};
}

/**@type {import('./types.d.mts')['queryElements']} */
function queryElements(target, selector, expectedTag, isList) {
	try {
		if (isList) {
			const elements = [...target.querySelectorAll(selector)];
			return expectedTag ? elements.filter((el) => el.tagName.toLowerCase() === expectedTag) : elements;
		} else {
			const el = target.querySelector(selector);
			if (el && expectedTag && el.tagName.toLowerCase() !== expectedTag) {
				throw new Error(
					`--> [createViewBinding.queryElements]: Error, expected <${expectedTag}>, but found <${el.tagName.toLowerCase()}>.`
				);
			}
			return el;
		}
	} catch (error) {
		throw new Error(`--> [createViewBinding.queryElements]: Error, failed to query "${selector}": ${error.message}`);
	}
}
