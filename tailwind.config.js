// tailwind.config.js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        flipY: {
          '0%, 20%': { transform: 'rotateY(0deg)' },   // samne aur thoda rukhe
          '50%': { transform: 'rotateY(180deg)' },     // peeche
          '80%, 100%': { transform: 'rotateY(360deg)' } // wapas front pe aur rukhe
        },
      },
      animation: {
        'flip-y': 'flipY 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
