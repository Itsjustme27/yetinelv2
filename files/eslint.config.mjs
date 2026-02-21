import react from "eslint-plugin-react";
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks"; 

export default [
  js.configs.recommended,
  {
    ignores: ["build/**", "dist/**", "node_modules/**"],
    files: ["**/*.{js,jsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off", // Not needed in modern React
      "react/no-danger": "error",        // Anti-XSS: Blocks dangerouslySetInnerHTML
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }]
    },
  },
];
