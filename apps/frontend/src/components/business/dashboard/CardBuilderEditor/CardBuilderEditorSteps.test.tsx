/**
 * CardBuilderEditorSteps — regression test for the step-8 label i18n bug.
 *
 * 2026-10-26 — the step indicator rendered the raw i18next fallback string
 * "key 'steps.save (zh-TW)' returned an object instead of string. (8/8)".
 * Root cause: `cardEditor.steps.save` was restructured from a flat string
 * into a nested object on 2026-10-06, but the step-8 labelKey still pointed
 * at the old scalar path `steps.save`.
 *
 * This test intentionally loads the REAL `cardEditor` locale resources via
 * `@/test/i18n` instead of mocking `react-i18next` with `t: (key) => key`.
 * That mock returns the key verbatim for every input, so it cannot tell a
 * leaf key from an object-valued key — the exact blind spot that let this
 * regression ship. With the real resources, an object-valued key resolves
 * to i18next's error string, which the assertions below detect.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@/test/i18n';
import { CardBuilderEditorSteps } from './CardBuilderEditorSteps';

const OBJECT_KEY_ERROR = 'returned an object instead of string';

function renderSteps(currentStep: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8) {
  return render(
    <I18nextProvider i18n={i18n}>
      <CardBuilderEditorSteps currentStep={currentStep} onStepClick={() => {}} />
    </I18nextProvider>,
  );
}

describe('CardBuilderEditorSteps — step label i18n', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-TW');
  });

  it('renders the translated step-8 progress label (regression — 2026-10-26)', () => {
    renderSteps(8);

    // `steps.save.title` → '儲存並發布'
    expect(screen.getByText('儲存並發布 (8/8)')).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(OBJECT_KEY_ERROR))).not.toBeInTheDocument();
  });

  it('renders every step pill tooltip as a translated string', () => {
    renderSteps(1);

    // Each pill carries `title={t(step.labelKey)}`. If any labelKey points at
    // an object-valued translation path, the tooltip becomes the i18next
    // error string instead of a label.
    const tooltips = screen.getAllByTitle(/.*/);
    const pillTooltips = tooltips.filter((el) => el.tagName === 'BUTTON');

    expect(pillTooltips).toHaveLength(8);
    for (const tooltip of pillTooltips) {
      const title = tooltip.getAttribute('title') ?? '';
      expect(title.length).toBeGreaterThan(0);
      expect(title).not.toContain(OBJECT_KEY_ERROR);
    }
  });

  it('does not render the i18next object-key error anywhere on step 8', () => {
    const { container } = renderSteps(8);

    expect(container.textContent ?? '').not.toContain(OBJECT_KEY_ERROR);
    expect(container.innerHTML).not.toContain(OBJECT_KEY_ERROR);
  });
});
