import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import VersionTimeline from "@/components/VersionTimeline";
import type { Version } from "@/lib/types";

const versi = (id: string, fileSize: number | null): Version => ({
  id,
  versionNumber: `v-${id}`,
  effectiveDate: "2026-01-01",
  status: "SAH",
  fileSize,
});

const render = (versions: Version[], tautanBerkas?: (id: string) => string) =>
  renderToStaticMarkup(
    createElement(VersionTimeline, { versions, tautanBerkas, today: "2026-11-12" }),
  );

describe("VersionTimeline: tautan unduh menurut prop tautanBerkas", () => {
  it("tanpa tautanBerkas: tidak ada tautan dan tidak ada teks Unduh PDF", () => {
    const html = render([versi("a", 100)]);

    expect(html).not.toContain("Unduh PDF");
    expect(html).not.toContain("/berkas");
  });

  it("dengan tautanBerkas: memuat tautan buatan fungsi itu", () => {
    const html = render([versi("a", 100)], (id) => `/x/${id}/berkas`);

    expect(html).toContain('href="/x/a/berkas"');
    expect(html).toContain("Unduh PDF");
  });

  it("versi tanpa berkas (fileSize null): tidak ada tautan walau tautanBerkas ada", () => {
    const html = render([versi("a", null)], (id) => `/x/${id}/berkas`);

    expect(html).not.toContain("Unduh PDF");
    expect(html).not.toContain("/berkas");
  });
});
