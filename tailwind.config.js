/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        fw: {
          bg:      '#1c120a',   // factory background
          surface: '#2c1e12',   // cards / panels
          deep:    '#140d06',   // deeper background
          border:  '#4a3520',   // borders
          text:    '#ecdcc4',   // cream text
          muted:   '#9a7a5a',   // muted text
          gold:    '#daa520',   // primary accent
          'gold-dim': '#9a7010',
          green:   '#00c758',   // up / positive
          'green-dim': '#007a35',
          red:     '#c04030',   // down / negative
          'red-dim': '#7a2820',
          yellow:  '#d4982a',   // warning / neutral
          amber:   '#fcbb00',
        },
      },
      fontFamily: {
        heading: ['Cinzel', 'serif'],
        mono:    ['IBM Plex Mono', 'monospace'],
      },
      boxShadow: {
        'gold-sm': '0 0 8px rgba(218,165,32,0.25)',
        'gold':    '0 0 20px rgba(218,165,32,0.35)',
        'green-sm':'0 0 8px rgba(0,199,88,0.25)',
      },
    },
  },
  plugins: [],
}
