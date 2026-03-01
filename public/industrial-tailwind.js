window.tailwind = window.tailwind || {};
window.tailwind.config = {
  theme: {
    extend: {
      colors: {
        industrial: {
          chassis: '#0e1622',
          panel: '#1b2737',
          recessed: '#142033',
          text: '#eaf0f8',
          muted: '#aebbd0',
          accent: '#4fd1a5',
          borderLight: 'rgba(255, 255, 255, 0.12)',
          borderShadow: 'rgba(5, 10, 20, 0.72)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        headline: ['"Playfair Display"', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },
      borderRadius: {
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '0.875rem',
        '2xl': '1rem',
        full: '9999px'
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,.06), 0 10px 24px rgba(3,8,18,.45)',
        floating: '0 1px 0 rgba(255,255,255,.1), 0 16px 30px rgba(3,8,18,.5)',
        pressed: 'inset 0 2px 5px rgba(3,8,18,.55), inset 0 -1px 0 rgba(255,255,255,.05)'
      }
    }
  }
};
