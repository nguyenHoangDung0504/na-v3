import { css, defineLightDOMComponent } from '../../src/index.mjs';

export default class AppRoot {}

AppRoot = defineLightDOMComponent('app-root', {
	style: style(),
});

function style() {
	return css`
		* {
			box-sizing: border-box;
			margin: 0;
			padding: 0;
		}

		:self {
			display: block;
			overflow-y: auto;
			min-height: 100vh;
			background-color: black;
		}

		@media (width < 400px) {
			:self {
				background-color: #333;
			}
		}

		@media (400px < width < 700px) {
			:self {
				background-color: #222;
			}
		}
	`;
}
