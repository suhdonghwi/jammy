declare module 'virtual:title-glyphs' {
  const glyphs: import('./glyphs').TitleGlyphs;
  export default glyphs;
  export const layouts: Record<import('./layout').TitleAlign, import('./layout').TitleLayout>;
}
