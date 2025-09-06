export const data = [];

/**@type {Map<string, number[]>} */
export const dataMap = new Map();

export function buildPush(fromModulePath = '_') {
	const [code] = arguments;
	if (!dataMap.has(fromModulePath)) dataMap.set(fromModulePath, []);

	return function () {
		// dataMap.get(fromModulePath).push(code);
		data.push([...arguments]);
	};
}
