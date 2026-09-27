/**
 * Builds a printable alphabet-practice worksheet (.docx): every letter beside a few blank,
 * bordered boxes to trace/copy by hand — for a parent who wants a paper copy for offline practice.
 * Generated entirely in the browser (no backend); `docx` is dynamically imported so it never adds
 * weight to the app's initial bundle.
 */
export async function buildAlphabetWorksheet(glyphs: string[], opts: { title: string; instructions: string; rtl: boolean }): Promise<Blob> {
  const {
    Document,
    Packer,
    Paragraph,
    Table,
    TableRow,
    TableCell,
    TextRun,
    WidthType,
    AlignmentType,
    HeadingLevel,
    BorderStyle,
    VerticalAlign,
    TableLayoutType,
    HeightRule,
  } = await import('docx');

  // US Letter, 1" margins on every side (twips: 1440 per inch) — usable width is exactly 9360 twips.
  const PAGE_MARGIN = 1440;
  const USABLE_WIDTH = 12240 - PAGE_MARGIN * 2;
  const LETTER_COL = 1800;
  const BOX_COL = Math.floor((USABLE_WIDTH - LETTER_COL) / 3);
  // Word only honours these widths when the table's layout is fixed — with the default "autofit"
  // it recalculates column widths from content and the boxes collapse to almost nothing.
  const columnWidths = [LETTER_COL, BOX_COL, BOX_COL, BOX_COL];

  const border = { style: BorderStyle.SINGLE, size: 4, color: 'C4B5FD' } as const;
  const cellBorders = { top: border, bottom: border, left: border, right: border };

  const cell = (width: number, children: InstanceType<typeof Paragraph>[], withBorder: boolean) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 200, bottom: 200 },
      borders: withBorder ? cellBorders : undefined,
      children,
    });

  const blankBox = () => cell(BOX_COL, [new Paragraph({ text: '' })], true);

  const rows = glyphs.map(
    (glyph) =>
      new TableRow({
        height: { value: 1100, rule: HeightRule.ATLEAST },
        children: [
          cell(
            LETTER_COL,
            [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                bidirectional: opts.rtl,
                children: [new TextRun({ text: glyph, size: 56, bold: true })],
              }),
            ],
            false,
          ),
          blankBox(),
          blankBox(),
          blankBox(),
        ],
      }),
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN } },
        },
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, children: [new TextRun(opts.title)] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(opts.instructions)] }),
          new Paragraph({ text: '' }),
          new Table({
            width: { size: USABLE_WIDTH, type: WidthType.DXA },
            columnWidths,
            layout: TableLayoutType.FIXED,
            visuallyRightToLeft: opts.rtl,
            rows,
          }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}
