/**
 * Type stubs for `openapi-response-validator` (the package ships
 * JS only, with a CommonJS default export).
 */
declare module 'openapi-response-validator' {
	export interface OpenAPIResponseValidatorError {
		message: string;
		path?: string;
		errorCode?: string;
	}

	export interface OpenAPIResponseValidatorOptions {
		customFormats?: Record<string, ((value: unknown) => boolean) | RegExp>;
		removeAdditional?: 'all' | 'failing' | 'none' | undefined;
		errorTransformer?: (errs: OpenAPIResponseValidatorError[]) => OpenAPIResponseValidatorError[];
		externals?: Record<string, unknown>;
		strict?: boolean;
		format?: 'openapi31' | 'openapi30';
	}

	// The package is `module.exports = OpenAPIResponseValidator` so we
	// declare it as a default-exported constructor.
	export default class OpenAPIResponseValidator {
		constructor(spec: unknown, options?: OpenAPIResponseValidatorOptions);
		validateResponse(
			path: string,
			method: string,
			status: number,
			body: unknown,
		): OpenAPIResponseValidatorError[];
	}
}