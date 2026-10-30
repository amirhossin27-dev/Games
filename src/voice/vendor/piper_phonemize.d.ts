export interface PiperPhonemizeModule {
  callMain(args: string[]): number;
}

export interface PiperPhonemizeOptions {
  print?: (line: string) => void;
  printErr?: (line: string) => void;
  locateFile?: (file: string) => string;
  noInitialRun?: boolean;
  wasmBinary?: ArrayBuffer;
  getPreloadedPackage?: (name: string, size: number) => ArrayBuffer;
}

declare const createPiperPhonemize: (opts?: PiperPhonemizeOptions) => Promise<PiperPhonemizeModule>;
export default createPiperPhonemize;
