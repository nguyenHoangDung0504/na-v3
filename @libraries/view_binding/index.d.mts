type Selector = `${string} as ${keyof HTMLElementTagNameMap}${'' | '[]'}` | `${string} as []` | (string & {});

type ViewMapDefinition = {
	[identify: string]: Selector;
};

export default function createViewBinding<ViewMap extends ViewMapDefinition>(viewMap: ViewMap): ViewBinding<ViewMap>;

interface ViewBinding<ViewMap extends ViewMapDefinition> {
	bind(target?: HTMLElement | Document): {
		[K in keyof ViewMap]: ViewMap[K] extends `${string} as ${infer EK extends keyof HTMLElementTagNameMap}[]`
			? HTMLElementTagNameMap[EK][]
			: ViewMap[K] extends `${string} as ${infer EK extends keyof HTMLElementTagNameMap}`
			? HTMLElementTagNameMap[EK] | null
			: ViewMap[K] extends `${string} as []`
			? HTMLElement[]
			: HTMLElement | null;
	} & {
		rebind(): void;
	};
}
