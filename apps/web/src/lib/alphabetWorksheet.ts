/**
 * Builds a printable alphabet-practice worksheet (.docx): every letter beside a few blank,
 * bordered boxes to trace/copy by hand — for a parent who wants a paper copy for offline practice.
 * Generated entirely in the browser (no backend); `docx` is dynamically imported so it never adds
 * weight to the app's initial bundle.
 */
export async function buildAlphabetWorksheet(glyphs: string[], opts: { title: string; instructions: string; rtl: boolean }): Promise<Blob> {
  const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, HeadingLevel, BorderStyle, VerticalAlign } = await import('docx');

  const border = { style: BorderStyle.SINGLE, size: 4, color: 'C4B5FD' } as const;
  const cellBorders = { top: border, bottom: border, left: border, right: border };

  const cell = (children: InstanceType<typeof Paragraph>[], withBorder: boolean) =>
    new TableCell({
      width: { size: 25, type: WidthType.PERCENTAGE },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 200, bottom: 200 },
      borders: withBorder ? cellBorders : undefined,
      children,
    });

  const blankBox = () => cell([new Paragraph({ text: '' })], true);

  const rows = glyphs.map(
    (glyph) =>
      new TableRow({
        children: [
          cell(
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
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, children: [new TextRun(opts.title)] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(opts.instructions)] }),
          new Paragraph({ text: '' }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}
