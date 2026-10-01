/** Trust applies to this exact file content for the current plugin session. */
export class CanvasTrustStore {
	private readonly sources = new Map<string, string>();

	isTrusted(path: string, source: string): boolean {
		return this.sources.get(path) === source;
	}

	grant(path: string, source: string): void {
		this.sources.set(path, source);
	}
}
