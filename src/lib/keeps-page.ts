/**
 * Marks forms and links that don't leave the page (a CSV download, the language switch), so a page with unsaved
 * changes lets them through without asking. Spread onto the element: `<form {...keepsPage}>`.
 */
export const KEEPS_PAGE_ATTRIBUTE = "data-keeps-page";

export const keepsPage = { [KEEPS_PAGE_ATTRIBUTE]: "" };
