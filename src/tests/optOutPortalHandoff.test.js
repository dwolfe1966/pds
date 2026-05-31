/**
 * OptOutLandingPage — portal handoff contract.
 *
 * BC owns the full opt-out search → request → verification flow at their
 * hosted portal. We hand off via `window.ApiWrapper.instance.goPage('optOut', { newPage })`.
 *
 * This contract has two non-obvious requirements that have regressed once
 * (2026-05-30) and must stay pinned:
 *
 *   1. The call MUST happen synchronously inside the click handler — any
 *      `await` or dynamic `import()` before window.open severs the user-gesture
 *      context and the popup gets blocked by the browser.
 *
 *   2. The receiver MUST be `window.ApiWrapper.instance.goPage` (the IIFE
 *      singleton's instance method), NOT `window.ApiWrapper.goPage`. The latter
 *      shape was the bug in the prior regression — looked correct, did nothing.
 *
 * Tests pin both the receiver path and the synchronous call.
 */

import React, { act } from 'react';
import ReactDOM from 'react-dom/client';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams('')],
  Link: ({ children, to }) => require('react').createElement('a', { href: to }, children),
}));

jest.mock('../api', () => ({
  __esModule: true,
  default: { confirmOptOut: jest.fn().mockResolvedValue({}) },
}));

let OptOutLandingPage;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  OptOutLandingPage = require('../pages/sales/OptOutLandingPage').default;
});

let container, root;
let mockGoPage;
let originalApiWrapper;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  mockNavigate.mockClear();
  mockGoPage = jest.fn();
  originalApiWrapper = window.ApiWrapper;
  // Pin the receiver shape: instance method, NOT static. This is the bug class.
  window.ApiWrapper = { instance: { goPage: mockGoPage } };
});

afterEach(() => {
  if (root) { act(() => root.unmount()); root = null; }
  document.body.removeChild(container);
  container = null;
  window.ApiWrapper = originalApiWrapper;
});

function render() {
  act(() => {
    root = ReactDOM.createRoot(container);
    root.render(React.createElement(OptOutLandingPage));
  });
}

function clickButton(label) {
  const buttons = Array.from(container.querySelectorAll('button'));
  const btn = buttons.find(b => b.textContent.includes(label));
  if (!btn) throw new Error(`Button matching "${label}" not found`);
  act(() => { btn.click(); });
}

describe('OptOutLandingPage — portal handoff', () => {
  test('"Open Opt-Out Portal" click calls window.ApiWrapper.instance.goPage("optOut", { newPage: false })', () => {
    render();
    clickButton('Open Opt-Out Portal');
    expect(mockGoPage).toHaveBeenCalledTimes(1);
    expect(mockGoPage).toHaveBeenCalledWith('optOut', { newPage: false });
  });

  test('"Open in a new tab instead" click passes { newPage: true }', () => {
    render();
    clickButton('Open in a new tab instead');
    expect(mockGoPage).toHaveBeenCalledTimes(1);
    expect(mockGoPage).toHaveBeenCalledWith('optOut', { newPage: true });
  });

  test('handler invokes goPage synchronously within the click (no async hop = gesture preserved)', () => {
    render();
    // Count call before/after click — no awaits in test, must be sync.
    expect(mockGoPage).toHaveBeenCalledTimes(0);
    clickButton('Open Opt-Out Portal');
    expect(mockGoPage).toHaveBeenCalledTimes(1);
  });
});

describe('OptOutLandingPage — handoff failure modes', () => {
  test('window.ApiWrapper undefined → user-facing error shown, no crash', () => {
    window.ApiWrapper = undefined;
    render();
    clickButton('Open Opt-Out Portal');
    expect(container.textContent).toContain("couldn't open the opt-out portal");
  });

  test('instance present but goPage missing → user-facing error shown', () => {
    window.ApiWrapper = { instance: { /* no goPage */ } };
    render();
    clickButton('Open Opt-Out Portal');
    expect(container.textContent).toContain("couldn't open the opt-out portal");
  });

  test('previously-buggy shape window.ApiWrapper.goPage (no .instance) is rejected', () => {
    // The bug class: static-looking shape. We assert this is NOT treated as a
    // valid receiver — protects against a regression re-wiring to the wrong place.
    const staticGoPage = jest.fn();
    window.ApiWrapper = { goPage: staticGoPage };
    render();
    clickButton('Open Opt-Out Portal');
    expect(staticGoPage).not.toHaveBeenCalled();
    expect(container.textContent).toContain("couldn't open the opt-out portal");
  });
});
