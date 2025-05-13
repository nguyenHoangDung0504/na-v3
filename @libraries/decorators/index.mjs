class DecoratorManager {
	decorators = {
		logger,
		catchError,
		memoize,
		debounce,
	};

	applyFor(Target, methods, decorators) {
		/**
		 * Các decorator hợp lệ sau khi được lọc
		 */
		const validDecorators = decorators
			.map((fnName) => this.decorators[fnName])
			.filter((decorator) => {
				if (typeof decorator === 'function') {
					return true;
				}
				console.warn(
					`--> [DecoratorManager] Warning, decorator ignored:`,
					decorator,
					`is not a function.`
				);
				return false;
			});

		if (validDecorators.length === 0) {
			console.warn(
				'--> [DecoratorManager] Warning, No valid decorators provided. Skipping.'
			);
			return;
		}

		/**
		 * Danh sách tên các method được áp dụng decorator
		 */
		const methodNameList =
			methods === '*'
				? Object.getOwnPropertyNames(Target.prototype).filter(
						(name) => typeof Target.prototype[name] === 'function'
				  )
				: methods;

		// Áp dụng decorators lên danh sách method
		methodNameList.forEach((methodName) => {
			const originalMethod = Target.prototype[methodName];

			if (typeof originalMethod !== 'function') {
				console.warn(
					`--> [DecoratorManager] Warning, Method ignored:`,
					methodName,
					`is not a valid function in class.`
				);
				return;
			}

			// Áp dụng từng decorator, giữ nguyên decorator cũ
			Target.prototype[methodName] = [noopDecorator, ...validDecorators].reduce(
				(decorated, decorator) => {
					const wrappedFunction = decorator(decorated);

					// Lưu lại tên class và method
					const newName = originalMethod.name.split('.').includes(Target.name)
						? originalMethod.name
						: `${Target.name}.${originalMethod.name}`;
					Object.defineProperty(wrappedFunction, 'name', {
						value: newName,
						configurable: true,
					});
					return wrappedFunction;
				},
				originalMethod
			);
		});

		console.log();

		function noopDecorator(originalMethod) {
			return function (...args) {
				return originalMethod.apply(this, args);
			};
		}

		return this;
	}

	registerDecorator(newDecorator) {
		for (const name of newDecorator) {
			this.decorators[name] = newDecorator;
		}
		return this;
	}
}

const decoratorManager = new DecoratorManager();
export default decoratorManager;

export function logger(originalMethod) {
	return function (...args) {
		const log = (result, isAsync = false) => {
			console.log(
				`----> [DecoratorManager.logger] Calling ${
					isAsync ? 'async ' : ''
				}method:\t ${originalMethod.name}`
			);
			console.log(`----> [DecoratorManager.logger] Params:\t\t`, args);
			console.log(`----> [DecoratorManager.logger] Result:\t\t`, result, '\n');
			return result;
		};

		const result = originalMethod.apply(this, args);

		if (result instanceof Promise) {
			return result
				.then((res) => {
					return log(res, true);
				})
				.catch((err) => {
					console.log(
						`----> [DecoratorManager.logger] From '${originalMethod.name}', Caught error (async):\n`,
						err,
						'\n'
					);
					throw err;
				});
		}

		return log(result);
	};
}

export function catchError(originalMethod) {
	return function (...args) {
		try {
			const result = originalMethod.apply(this, args);

			if (result instanceof Promise) {
				return result.catch((error) => {
					console.error(
						`----> [DecoratorManager.catchError] Error when calling '${originalMethod.name}':`,
						error
					);
					return undefined;
				});
			}

			return result;
		} catch (error) {
			console.error(
				`----> [DecoratorManager.catchError] Error when calling '${originalMethod.name}':`,
				error
			);
			return undefined;
		}
	};
}

/**
 * Memoizes a given function by caching its computed results.
 * @param {Function} fn - The function to memoize.
 * @returns {Function} - A new memoized version of the function.
 */
export function memoize(fn) {
	const cache = new Map();
	const objectCache = new WeakMap();
	const fnName = fn.name;

	/**
	 * Generates a cache key based on the arguments.
	 * @param {Array} args - The arguments provided to the function.
	 * @returns {string|object} - A cache key which can be a string or an object.
	 */
	function getCacheKey(args) {
		return args.length === 1 ? args[0] : JSON.stringify(args);
	}

	return function (...args) {
		const key = getCacheKey(args);

		if (typeof key === 'object' && key !== null) {
			if (objectCache.has(key)) {
				const rs = objectCache.get(key);
				console.log(
					`[Decorators.memoize] Object cache hit for [${fnName}]:`,
					'\nParams:',
					args,
					'\nResult:',
					rs,
					'\n\n'
				);
				return rs;
			}
		} else {
			if (cache.has(key)) {
				const rs = cache.get(key);
				console.log(
					`[Decorators.memoize] Cache hit for [${fnName}]:`,
					'\nParams:',
					args,
					'\nResult:',
					rs,
					'\n\n'
				);
				return rs;
			}
		}

		let result;

		try {
			result = fn.apply(this, args);
		} catch (error) {
			throw error;
		}

		if (result instanceof Promise) {
			result = result.catch((error) => {
				if (typeof key === 'object' && key !== null) {
					objectCache.delete(key);
				} else {
					cache.delete(key);
				}
				throw error;
			});
		}

		if (typeof key === 'object' && key !== null) {
			objectCache.set(key, result);
		} else {
			cache.set(key, result);
		}

		return result;
	};
}

/**
 * Creates a debounced version of the provided function.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The number of milliseconds to delay.
 * @param {boolean} [immediate=false] - Whether to execute the function immediately.
 * @returns {Function} - A debounced version of the provided function.
 */
export function debounce(func, wait, immediate = false) {
	let timeout;

	return function (...args) {
		const context = this;

		return new Promise((resolve, reject) => {
			const later = function () {
				timeout = null;
				if (!immediate) {
					try {
						const result = func.apply(context, args);
						if (result instanceof Promise) {
							result.then(resolve).catch(reject);
						} else {
							resolve(result);
						}
					} catch (error) {
						reject(error);
					}
				}
			};

			const callNow = immediate && !timeout;

			clearTimeout(timeout);
			timeout = setTimeout(later, wait);

			if (callNow) {
				try {
					const result = func.apply(context, args);
					if (result instanceof Promise) {
						result.then(resolve).catch(reject);
					} else {
						resolve(result);
					}
				} catch (error) {
					reject(error);
				}
			}
		});
	};
}
