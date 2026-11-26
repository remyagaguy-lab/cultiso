import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  // Charge next.config et les fichiers .env dans l'environnement de test
  dir: './',
})

// Dossiers qui ne sont pas du code de l'application (outils, archives, infra).
const dossiersHorsApplication = [
  '<rootDir>/node_modules/',
  '<rootDir>/.next/',
  '<rootDir>/ui-ux-pro-max/',
  '<rootDir>/workers/',
  '<rootDir>/Cloud/',
  '<rootDir>/terraform/',
  '<rootDir>/scripts/',
  '<rootDir>/test.js',
]

// Environnement par défaut : jsdom (composants d'interface).
// Le code serveur (src/cultisia, src/app/api) déclare `@jest-environment node` en tête de fichier de test.
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: dossiersHorsApplication,
  modulePathIgnorePatterns: ['<rootDir>/ui-ux-pro-max/', '<rootDir>/workers/', '<rootDir>/Cloud/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

// Exporté ainsi pour que next/jest puisse charger la configuration Next.js (asynchrone)
export default createJestConfig(config)
