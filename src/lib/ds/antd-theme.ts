// Thèmes Ant Design branchés sur le design system Orkedio (marque Cultiso, clair et nuit).
// Valeurs résolues issues de src/styles/ds/antd-cultiso-{light,dark}.json (générés à la source).
import { theme, type ThemeConfig } from "antd";
import light from "@/styles/ds/antd-cultiso-light.json";
import dark from "@/styles/ds/antd-cultiso-dark.json";

const FONT = "var(--font-plus-jakarta), 'Plus Jakarta Sans', system-ui, sans-serif";

function build(src: typeof light, algorithm: ThemeConfig["algorithm"], isDark: boolean): ThemeConfig {
  const { wireframe: _w, controlHeight: _h, ...token } = src.token;
  void _w;
  void _h;
  const placeholderColor = src.token.colorTextSecondary;
  const surfaceRaised = src.token.colorBgContainer;
  const surfaceSunken = src.token.colorBgLayout;
  const surfaceOverlay = src.token.colorBgElevated;
  const selectedBg = src.token.colorBorderSecondary;
  const hoverBg = src.token.colorBgElevated;

  return {
    algorithm,
    token: {
      ...token,
      fontFamily: FONT,
      // 44 px = cible tactile minimale du design system Orkedio (standard 48 px dans le JSON généré, aligné 44 px pour la densité applicative)
      controlHeight: 44,
      colorTextPlaceholder: placeholderColor,
      colorIcon: src.token.colorTextSecondary,
      colorIconHover: src.token.colorText,
    },
    components: {
      Typography: { fontFamily: FONT },
      Card: {
        borderRadiusLG: 12,
        colorBgContainer: surfaceRaised,
      },
      Table: {
        borderRadius: 9,
        colorBgContainer: surfaceRaised,
        headerBg: surfaceSunken,
        headerColor: src.token.colorTextSecondary,
        rowHoverBg: hoverBg,
        borderColor: src.token.colorBorderSecondary,
      },
      Select: {
        selectorBg: isDark ? surfaceSunken : surfaceRaised,
        colorBgContainer: isDark ? surfaceSunken : surfaceRaised,
        colorBgElevated: surfaceOverlay,
        colorText: src.token.colorText,
        colorTextPlaceholder: placeholderColor,
        optionSelectedBg: selectedBg,
        optionSelectedColor: src.token.colorText,
        optionActiveBg: hoverBg,
      },
      Button: {
        defaultBg: isDark ? surfaceOverlay : surfaceSunken,
        defaultColor: src.token.colorText,
        defaultBorderColor: src.token.colorBorder,
        defaultHoverBg: isDark ? src.token.colorBorderSecondary : src.token.colorBorderSecondary,
        defaultHoverColor: src.token.colorText,
        defaultHoverBorderColor: src.token.colorTextSecondary,
        primaryColor: src.token.colorTextLightSolid,
      },
      Drawer: {
        colorBgElevated: surfaceRaised,
        colorText: src.token.colorText,
        colorIcon: src.token.colorTextSecondary,
      },
    },
  };
}

export const antdThemes = {
  light: build(light, theme.defaultAlgorithm, false),
  dark: build(dark as typeof light, theme.darkAlgorithm, true),
};

export const antdTheme = antdThemes.light;
