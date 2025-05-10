import { css, defineLightDOMComponent, html, RenderableComponent } from '../../src/index.mjs';

export default class AppHeader extends RenderableComponent {
	static DEBUG_MOD = true;

	/**
	 * @override
	 */
	connectedCallback() {
		super.connectedCallback();
	}

	__testFunction__() {
		console.log('close!');
	}
}

AppHeader = defineLightDOMComponent('app-header', {
	Prototype: AppHeader,
	style: style(),
	body: body(),
});

function body() {
	return html`
		<h2>Hello, @render:user-name!</h2>
		<input type="text" placeholder="@render:place-holder" />
	`;
}

function style() {
	return css`
		:self {
			display: flex;
			padding: 10px;
			background-color: #333;
			border: 1px solid green;
			justify-content: space-between;
			align-items: center;
		}

		:self > h2 {
			flex: 1;
			color: white;
		}

		:self > input[type='text'] {
			flex: 0.3;
			padding: 10px;
			outline: none;
			border: none;
		}
	`;
}
