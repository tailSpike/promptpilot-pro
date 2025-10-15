import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LinearBuilderV2 } from '../components/LinearBuilderV2';
import { MemoryRouter } from 'react-router-dom';

describe('LinearBuilderV2 component', () => {
  it('renders and supports adding/removing Additional variables; Save disabled until valid', async () => {
    render(
      <MemoryRouter>
        <LinearBuilderV2 />
      </MemoryRouter>
    );

    // Initially, Save disabled because no steps
    const saveBtn = screen.getByTestId('save-workflow') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);

    // Add a step
    fireEvent.click(screen.getByTestId('add-step'));
    fireEvent.click(screen.getByTestId('step-type-PROMPT'));

    // Open Data inspector
    fireEvent.click(screen.getByTestId('data-inspector-toggle'));
    expect(screen.getByTestId('data-inspector')).toBeInTheDocument();

    // Add variable row
    fireEvent.click(screen.getByText('Add variable'));
    const keyInputs = screen.getAllByPlaceholderText('key');
    const valInputs = screen.getAllByPlaceholderText('value');
    expect(keyInputs.length).toBeGreaterThan(0);
    expect(valInputs.length).toBeGreaterThan(0);

    // Enter key/value
    fireEvent.change(keyInputs[0], { target: { value: 'topic' } });
    fireEvent.change(valInputs[0], { target: { value: 'Testing' } });

    // Save should be enabled now that we have a step and a name
    const nameInput = screen.getByTestId('workflow-name-input') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'My Workflow' } });
    expect((screen.getByTestId('save-workflow') as HTMLButtonElement).disabled).toBe(false);
  });

  it('typed select switching preserves key; boolean toggle works; invalid number blocks Save', async () => {
    render(
      <MemoryRouter>
        <LinearBuilderV2 />
      </MemoryRouter>
    );

    // Add a step so Save can enable when valid
    fireEvent.click(screen.getByTestId('add-step'));
    fireEvent.click(screen.getByTestId('step-type-PROMPT'));

    // Open Data inspector and add a variable row
    fireEvent.click(screen.getByTestId('data-inspector-toggle'));
    fireEvent.click(screen.getByText('Add variable'));

    const nameInput = screen.getByTestId('workflow-name-input') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Typed Test' } });

    const keyInput = screen.getAllByPlaceholderText('key')[0] as HTMLInputElement;
    const valInput = screen.getAllByPlaceholderText('value')[0] as HTMLInputElement;
    const typeSelect = screen.getByTestId('data-inspector').querySelector('select[data-testid="data-inspector-var-type"]') as HTMLSelectElement;

    // Set key/value
    fireEvent.change(keyInput, { target: { value: 'num' } });
    // Switch to number type and enter invalid value
    fireEvent.change(typeSelect, { target: { value: 'number' } });
    fireEvent.change(valInput, { target: { value: 'abc' } });

    // Save should be disabled due to invalid number
    expect((screen.getByTestId('save-workflow') as HTMLButtonElement).disabled).toBe(true);

    // Fix number and ensure Save enabled
    fireEvent.change(valInput, { target: { value: '123' } });
    expect((screen.getByTestId('save-workflow') as HTMLButtonElement).disabled).toBe(false);

    // Switch to boolean type; key should be preserved and boolean dropdown visible
    fireEvent.change(typeSelect, { target: { value: 'boolean' } });
    expect(keyInput.value).toBe('num');
    const boolSelect = screen.getByTestId('data-inspector').querySelector('select[data-testid="data-inspector-var-value-boolean"]') as HTMLSelectElement;
    expect(boolSelect).toBeInTheDocument();
    // Toggle boolean value to false
    fireEvent.change(boolSelect, { target: { value: 'false' } });
    expect(boolSelect.value).toBe('false');

    // Switch back to string; key preserved, input shown
    fireEvent.change(typeSelect, { target: { value: 'string' } });
    expect(keyInput.value).toBe('num');
    const strValInput = screen.getAllByPlaceholderText('value')[0] as HTMLInputElement;
    expect(strValInput).toBeInTheDocument();
  });

  it('inserts variable token at cursor position within prompt content', async () => {
    render(
      <MemoryRouter>
        <LinearBuilderV2 />
      </MemoryRouter>
    );
    // Add two steps
    fireEvent.click(screen.getByTestId('add-step'));
    fireEvent.click(screen.getByTestId('step-type-PROMPT'));
    fireEvent.click(screen.getByTestId('add-step'));
    fireEvent.click(screen.getByTestId('step-type-PROMPT'));

    // Focus step 2 input and place cursor in middle of text
    const stepInputs = screen.getAllByTestId('input-field-promptContent') as HTMLInputElement[];
    const second = stepInputs[1];
    // Set initial content
    fireEvent.change(second, { target: { value: 'Start End' } });
  // Focus and set selection between words (after 'Start')
  fireEvent.focus(second);
  // jsdom supports setting selectionStart/End directly
  second.setSelectionRange?.(5, 5);

    // Click variable from list
    const varItem = screen.getByTestId('variable-item-workflow.input');
    fireEvent.click(varItem);

    // Expect token inserted with spacing preserved
    await new Promise((r) => setTimeout(r, 0));
    const updated = screen.getAllByTestId('input-field-promptContent')[1] as HTMLInputElement;
    expect(updated.value).toContain('Start {{workflow.input}} End');
  });
});
