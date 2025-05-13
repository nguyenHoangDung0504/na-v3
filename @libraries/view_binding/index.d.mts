type UntypedListSelector = `${string} as []`;
type TypedSelector = `${string} as ${keyof HTMLElementTagNameMap}${'' | '[]'}`;
type RawSelector = string & {};
type Selector = TypedSelector | UntypedListSelector | RawSelector;
type ViewMapDefinition = Record<string, Selector>;

/**
 * Create a binding between the selector in `viewMap` and the DOM elements.
 * @param viewMap - Define selector mapping
 */
export default function createViewBinding<ViewMap extends ViewMapDefinition>(
	viewMap: ViewMap
): ViewBinding<ViewMap>;

interface ViewBinding<ViewMap extends ViewMapDefinition> {
	bind<Root extends HTMLElement | Document>(
		target?: Root
	): {
		[K in keyof ViewMap]: ViewMap[K] extends `${string} as ${infer Tag extends keyof HTMLElementTagNameMap}[]`
			? HTMLElementTagNameMap[Tag][]
			: ViewMap[K] extends `${string} as ${infer Tag extends keyof HTMLElementTagNameMap}`
			? HTMLElementTagNameMap[Tag] | null
			: ViewMap[K] extends `${string} as []`
			? HTMLElement[]
			: HTMLElement | null;
	} & {
		root: Root;
		rebind(): void;
	};
}
