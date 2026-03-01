window.tailwind = window.tailwind || {};
window.tailwind.config = {
  theme: {
    extend: {
      colors: {
        newsprint: {
          paper: '#F9F9F7',
          ink: '#111111',
          muted: '#E5E5E0',
          accent: '#CC0000'
        }
      },
      fontFamily: {
        headline: ['"Playfair Display"', 'serif'],
        body: ['Lora', 'serif'],
        ui: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },
      borderRadius: {
        none: '0px'
      },
      boxShadow: {
        hard: '4px 4px 0 #111111'
      }
    }
  }
};
