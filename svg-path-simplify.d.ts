declare module 'svg-path-simplify' {
  interface SimplifyOptions {
    decimals?: number;
    toRelative?: boolean;
    toShorthands?: boolean;
    extrapolateDominant?: boolean;
    minifyD?: number;
    getObject?: boolean;
  }
  interface SimplifyResult {
    svg: string;
    d: string;
    report: { original: number; new: number; saved: number; compression: number; decimals: number };
  }
  export function svgPathSimplify(input: string, options?: SimplifyOptions): string | SimplifyResult;
}
