import { defineConfig } from "eslint/config"
import globals from "globals"
import js from "@eslint/js"

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/all"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "capitalized-comments": "off",
      "class-methods-use-this": "off",
      "consistent-this": ["error", "self"],
      eqeqeq: "off",
      "func-names": "off",
      "func-style": "off",
      "id-length": "off",
      "max-classes-per-file": "off",
      "max-depth": ["warn", 5],
      "max-lines": "off",
      "max-lines-per-function": "off",
      "max-params": ["error", 5],
      "max-statements": "off",
      "no-await-in-loop": "off",
      "no-bitwise": "off",
      "no-console": "off",
      "no-continue": "off",
      "no-empty-function": "off",
      "no-eq-null": "off",
      "no-magic-numbers": "off",
      "no-nested-ternary": "off",
      "no-plusplus": "off",
      "no-ternary": "off",
      "no-underscore-dangle": "off",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-warning-comments": "off",
      "object-shorthand": "off",
      "one-var": "off",
      "prefer-arrow-callback": "off",
      "prefer-destructuring": "off",
      radix: "off",
      "sort-keys": "off",
      "sort-vars": "off"
    }
  }
])
