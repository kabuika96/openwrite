declare module "jsdom" {
  export class JSDOM {
    constructor(
      html?: string,
      options?: {
        beforeParse?: (window: Window & typeof globalThis) => void;
        pretendToBeVisual?: boolean;
        runScripts?: "dangerously" | "outside-only";
      },
    );

    window: Window & typeof globalThis & { close: () => void };
  }
}
