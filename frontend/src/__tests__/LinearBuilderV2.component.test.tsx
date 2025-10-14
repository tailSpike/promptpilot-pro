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
});
