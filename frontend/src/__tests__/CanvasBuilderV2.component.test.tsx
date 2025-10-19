import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CanvasBuilderV2 } from '../components/CanvasBuilderV2';

describe('CanvasBuilderV2 component', () => {
  it('can quick-add nodes, connect them to open mapping popover, and apply mapping', () => {
    render(<CanvasBuilderV2 />);

    // Open step library and add two steps
    const libBtn = screen.getByTestId('canvas-step-library-button');
    fireEvent.click(libBtn);
    fireEvent.click(screen.getByTestId('canvas-add-step-PROMPT'));
    fireEvent.click(screen.getByTestId('canvas-add-step-TRANSFORM'));

    const nodes = screen.getAllByTestId(/canvas-node-/);
    expect(nodes.length).toBeGreaterThanOrEqual(2);

    // Connect: mousedown on output of first, mouseup on input of second
    const first = nodes[0];
    const second = nodes[1];
    const outHandle = first.querySelector('[data-testid="handle-output"]') as HTMLElement;
    const inHandle = second.querySelector('[data-testid="handle-input"]') as HTMLElement;
    fireEvent.mouseDown(outHandle, { button: 0 });
    fireEvent.mouseUp(inHandle);

    // Popover visible
    const popover = screen.getByTestId('edge-popover');
    expect(popover).toBeTruthy();
    const pathInput = screen.getByTestId('edge-mapping-path') as HTMLInputElement;
    fireEvent.change(pathInput, { target: { value: 'output.text' } });
    fireEvent.click(screen.getByTestId('edge-mapping-apply'));

    // Popover should close
    expect(screen.queryByTestId('edge-popover')).toBeNull();
  });
});
