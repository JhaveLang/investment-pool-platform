"use client";

import type { ComponentProps } from "react";
import { Select } from "./select";

/** A select that submits its (GET) form as soon as the choice changes, e.g. a month filter. */
export function AutoSubmitSelect(selectProps: ComponentProps<typeof Select>) {
  return <Select {...selectProps} onChange={(event) => event.currentTarget.form?.requestSubmit()} />;
}
