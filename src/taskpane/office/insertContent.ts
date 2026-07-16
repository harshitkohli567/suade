/* global Word */

import { DocumentSection } from "@/types";

/**
 * Inserts text into the document as a Word tracked change (FR-7.4),
 * appended after the last paragraph of the given section (FR-7.2,
 * "section_end" anchor -- matches every Skill's insertionRule in the
 * registry today). Splits on blank lines into separate paragraphs so
 * multi-paragraph output doesn't land as one giant paragraph with
 * embedded line breaks.
 *
 * UNTESTED against live Word -- I do not have Word running in this
 * environment. Most likely failure points if something goes wrong:
 * (a) Word.ChangeTrackingMode.trackAll casing/availability (requires
 * WordApi 1.4, which the manifest now declares), (b) paragraph.
 * insertParagraph() formatting/list-numbering inheritance behaving
 * differently than expected. If insertion fails or looks wrong, tell me
 * the exact error or exact visual result and I'll fix it against real
 * feedback rather than guessing twice.
 */
function splitIntoParagraphBlocks(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s*\n\s*/g, " ").trim())
    .filter((block) => block.length > 0);
}

export async function insertTextAtSectionEnd(section: DocumentSection, text: string): Promise<void> {
  return Word.run(async (context) => {
    context.document.load("changeTrackingMode");
    const paragraphs = context.document.body.paragraphs;
    paragraphs.load("items");
    await context.sync();

    const endIndex = section.endParagraphIndex ?? paragraphs.items.length - 1;
    if (endIndex < 0 || endIndex >= paragraphs.items.length) {
      throw new Error(`Cannot insert: section end index ${endIndex} is out of range.`);
    }

    const previousMode = context.document.changeTrackingMode;
    context.document.changeTrackingMode = Word.ChangeTrackingMode.trackAll;
    await context.sync();

    const blocks = splitIntoParagraphBlocks(text);

    let insertAfter = paragraphs.items[endIndex];
    for (const block of blocks) {
      insertAfter = insertAfter.insertParagraph(block, Word.InsertLocation.after);
    }

    await context.sync();

    context.document.changeTrackingMode = previousMode;
    await context.sync();
  });
}

/**
 * Cursor-anchored insertion ("cursor" anchor) -- the fallback when no
 * section is detected, e.g. a blank document during matter intake.
 * Paragraphs land after the paragraph the cursor sits in, as tracked
 * changes, using the same paragraph-splitting as section insertion.
 */
export async function insertTextAtCursor(text: string): Promise<void> {
  return Word.run(async (context) => {
    context.document.load("changeTrackingMode");
    const selectionParagraphs = context.document.getSelection().paragraphs;
    selectionParagraphs.load("items");
    await context.sync();

    if (selectionParagraphs.items.length === 0) {
      throw new Error("Cannot insert: no cursor position found in the document.");
    }

    const previousMode = context.document.changeTrackingMode;
    context.document.changeTrackingMode = Word.ChangeTrackingMode.trackAll;
    await context.sync();

    const blocks = splitIntoParagraphBlocks(text);

    let insertAfter = selectionParagraphs.items[selectionParagraphs.items.length - 1];
    for (const block of blocks) {
      insertAfter = insertAfter.insertParagraph(block, Word.InsertLocation.after);
    }

    await context.sync();

    context.document.changeTrackingMode = previousMode;
    await context.sync();
  });
}
