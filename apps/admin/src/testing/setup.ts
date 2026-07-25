// Vitest setup — runs before every test file.
// WHY: registers @testing-library/jest-dom's custom matchers (toBeInTheDocument, etc.) globally so
// component tests can assert on the DOM. Slice/unit tests don't need them but the import is harmless.
import '@testing-library/jest-dom/vitest';
