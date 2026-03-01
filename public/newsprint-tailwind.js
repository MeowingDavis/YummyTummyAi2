window.tailwind = window.tailwind || {};
window.tailwind.config = {
  theme: {
    extend: {
      colors: {
        newsprint: {
          paper: '#141a27',
          ink: '#e6e9ef',
          muted: '#1b2435',
          accent: '#34d399'
        }
      },
      fontFamily: {
        headline: ['"Playfair Display"', 'serif'],
        body: ['Inter', 'sans-serif'],
        ui: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },
      borderRadius: {
        none: '0px'
      },
      boxShadow: {
        hard: '2px 2px 0 rgba(226, 232, 240, 0.28)'
      }
    }
  }
};
