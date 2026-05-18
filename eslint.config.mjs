import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Discourage direct Firebase imports outside the service adapters.
    // Use '@/lib/services' instead so the backend stays swappable.
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["firebase/firestore", "firebase/auth", "firebase/storage"],
              message:
                "Import from '@/lib/services' instead of Firebase directly. " +
                "Exception: files inside src/lib/services/firebase/ may import Firebase.",
            },
          ],
        },
      ],
    },
    ignores: ["src/lib/services/firebase/**"],
  },
];

export default eslintConfig;
