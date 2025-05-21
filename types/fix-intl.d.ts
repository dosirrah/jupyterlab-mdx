// types/fix-intl.d.ts
declare namespace Intl {
  interface ResolvedRelativeTimeFormatOptions {
    locale: string;
    style?: 'long' | 'short' | 'narrow';
    numeric?: 'always' | 'auto';
  }
}
