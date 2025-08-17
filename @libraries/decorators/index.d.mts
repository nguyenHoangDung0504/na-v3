type MethodNames<T> = {
	[K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

type Decorator = <TargetFn extends (...args: any) => any>(
	fn: TargetFn,
	...options: any[]
) => (...args: Parameters<TargetFn>) => ReturnType<TargetFn>;

declare class DecoratorManager<RegisteredDecorators extends Record<string, Decorator> = {}> {
	public constructor();

	applyFor<TargetClass extends new (...args: any[]) => any>(
		Target: TargetClass,
		methods: MethodNames<InstanceType<TargetClass>>[] | '*',
		decorators: (keyof RegisteredDecorators)[] | '*'
	): this;

	registerDecorator<NewDecorators extends Record<string, Decorator>>(
		decorators: NewDecorators
	): DecoratorManager<RegisteredDecorators & NewDecorators>;
}

declare const decoratorManager: DecoratorManager<{
	logger: Decorator;
	catchError: Decorator;
	test: Decorator;
	memoize: Decorator;
	debounce: Decorator;
}>;

export default decoratorManager;
export function debugMode(mode: boolean): void;

/**
 * Creates a debounced version of the provided function.
 * @param func - The function to debounce.
 * @param wait - The number of milliseconds to delay.
 * @param [immediate=false] - Whether to execute the function immediately.
 * @returns A debounced version of the provided function.
 */
export function debounce(func: Function, wait: number, immediate: boolean = false): Function;
