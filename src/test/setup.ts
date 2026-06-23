import '@testing-library/jest-dom/vitest';

HTMLElement.prototype.setPointerCapture = () => undefined;
HTMLElement.prototype.releasePointerCapture = () => undefined;
HTMLElement.prototype.hasPointerCapture = () => false;
