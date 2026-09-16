/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      // A 16-column page grid, so a sidebar rail can be 5/16 (31%) rather than being
      // forced to choose between 3/12 (25%, too narrow for the lifted type) and 4/12 (33%).
      gridTemplateColumns: {
        16: 'repeat(16, minmax(0, 1fr))',
      },
      gridColumn: {
        'span-11': 'span 11 / span 11',
      },
      // The small end of the scale, lifted. Measured across the eight tabs, 42% of all
      // visible text was under 12px and text-xs at 12px was the workhorse for body copy —
      // which is how a product ends up being described as hard to read. Each step here
      // carries its own line-height so raising the size does not crush the leading.
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.125rem' }],   // 13px / 18px  (was 12/16)
        sm: ['0.9375rem', { lineHeight: '1.375rem' }],   // 15px / 22px  (was 14/20)
        base: ['1.0625rem', { lineHeight: '1.625rem' }], // 17px / 26px  (was 16/24)
        lg: ['1.1875rem', { lineHeight: '1.75rem' }],    // 19px / 28px  (was 18/28)
      },
    },
  },
  plugins: [],
};
