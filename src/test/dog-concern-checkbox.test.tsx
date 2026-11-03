import { useState } from "react";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { DogConcernCheckbox } from "@/components/dog-concern-checkbox";

afterEach(cleanup);

it("selects and deselects a dog concern through the native checkbox", () => {
  function Field() {
    const [checked, setChecked] = useState(false);
    return (
      <label>
        <DogConcernCheckbox checked={checked} onCheckedChange={setChecked} />
        Sensitive Stomach
      </label>
    );
  }
  render(<Field />);
  const checkbox = screen.getByRole("checkbox", { name: "Sensitive Stomach" });
  expect(checkbox).not.toBeChecked();
  fireEvent.click(checkbox);
  expect(checkbox).toBeChecked();
  fireEvent.click(checkbox);
  expect(checkbox).not.toBeChecked();
});
