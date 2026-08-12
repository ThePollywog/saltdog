import { createVuetify } from "vuetify";
import { aliases, mdi } from "vuetify/iconsets/mdi-svg";
import "vuetify/styles";
import { initialTheme } from "../composables/useAppTheme.js";

// Navy carries structure; gold is an accent that never carries body text.
//
// Contrast notes (WCAG AA needs 4.5:1 for body text):
//   dark  — gold #C8A951 on #0A1628 = 8.05:1 (AAA)
//   light — navy #0A2E5C on #FFFFFF = 13.4:1 (AAA)
//   light — the bright gold #C8A951 on white is only 2.27:1 and FAILS, so any
//           gold-toned text in light mode uses the darkened #8A6D1F (4.86:1).
//           `accent` stays bright but is only ever used for rules and borders.
const saltLight = {
  dark: false,
  colors: {
    background: "#F4F6FA",
    surface: "#FFFFFF",
    "surface-variant": "#E7ECF3",
    "on-surface-variant": "#3C4B60",
    primary: "#0A2E5C",
    "primary-darken-1": "#06203F",
    secondary: "#8A6D1F",
    accent: "#C8A951",
    error: "#A82A22",
    warning: "#8A5A00",
    success: "#1E6B45",
    info: "#1F4E79",
    "on-background": "#141A22",
    "on-surface": "#141A22",
  },
  variables: { "border-color": "#C3CDDB", "border-opacity": 0.9 },
};

const saltDark = {
  dark: true,
  colors: {
    background: "#0A1628",
    surface: "#10203A",
    "surface-variant": "#1A2E4A",
    "on-surface-variant": "#B8C6D9",
    primary: "#C8A951",
    "primary-darken-1": "#A98C3C",
    secondary: "#6FA3DC",
    accent: "#C8A951",
    error: "#F08A80",
    warning: "#E0B34D",
    success: "#5FCF97",
    info: "#7FB6E8",
    "on-background": "#E8EDF4",
    "on-surface": "#E8EDF4",
    "on-primary": "#0A1628",
  },
  variables: { "border-color": "#2A4266", "border-opacity": 1 },
};

export default createVuetify({
  icons: { defaultSet: "mdi", aliases, sets: { mdi } },
  theme: {
    // Resolved before mount, so a user who chose light mode never sees a dark
    // flash on load.
    defaultTheme: initialTheme(),
    themes: { saltLight, saltDark },
  },
  // Defaults chosen to read as a controlled government document rather than a
  // consumer app: no ripples, square buttons, borders instead of shadows.
  defaults: {
    global: { ripple: false },
    VBtn: {
      variant: "flat",
      rounded: 0,
      style: "text-transform:none; letter-spacing:.2px;",
    },
    VCard: { rounded: "sm", flat: true, border: true },
    VTextField: { variant: "outlined", density: "comfortable", hideDetails: "auto" },
    VTextarea: { variant: "outlined", density: "comfortable", hideDetails: "auto" },
    VSelect: { variant: "outlined", density: "comfortable", hideDetails: "auto" },
    VAutocomplete: { variant: "outlined", density: "comfortable", hideDetails: "auto" },
    VChip: { rounded: "sm", variant: "tonal", size: "small" },
    VAppBar: { flat: true, border: "b", density: "comfortable" },
    VTabs: { density: "comfortable" },
    VList: { density: "compact" },
    VAlert: { variant: "tonal", rounded: "sm", density: "comfortable" },
  },
});
