
module.exports = {

  mode: "jit",
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "media",
  plugins: [
    require('daisyui'),
    require("@tailwindcss/typography")
  ],
  theme: {
    fontFamily: {
      sans: ["Inter", "sans-serif"],
    },
    extend: {
      colors: {
        "shrub-green": "#38f6c9",
        "shrub-green-50": "#f0fdf9",
        "shrub-green-100": "#8ACCA4",
        "shrub-green-200": "#3ccb7f",
        "shrub-green-300": "#219f80",
        "shrub-green-400": "#73e2a3",
        "shrub-green-500": "#17725C",
        "shrub-green-900": "#0A4736",
        "shrub-blue": "#101828",
        "shrub-grey": "#475467",
        "shrub-grey-light": "#FCFCFD",
        "shrub-grey-light2": "#EAECF0",
        "shrub-grey-light3": "#F9F5FF",
        "shrub-grey-50": "#D0D5DD",
        "shrub-grey-100": "#98A2B3",
        "shrub-grey-200": "#667085",
        "shrub-grey-700": "#344054",
        "shrub-grey-900": "#202939",
      },
      boxShadow: {
        shrub: "0px 4px 250px rgba(138, 204, 164, 0.25)",
        "shrub-thin":
          "0px 1px 2px rgba(16, 24, 40, 0.05), 0px 0px 0px 4px #CCFBEF",
      },
      userSelect: {
        none: ["input", "button"],
      },
    },
  },
  daisyui: {
    styled: true,
    themes: [
    ],
    base: true,
    utils: true,
    logs: true,
    rtl: false,
  },
}
