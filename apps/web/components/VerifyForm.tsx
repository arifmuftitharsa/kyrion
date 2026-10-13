"use client";

// Satu-satunya Client Component: form butuh state interaktif (pilihan
// regulasi/versi, berkas, hasil) yang tidak bisa ditangani di server.
import { useState, type FormEvent } from "react";
import VerifyResult from "@/components/VerifyResult";
import { focusRing } from "@/lib/styles";
import type { Regulation, VersionStatus } from "@/lib/types";

interface VerifyFormProps {
  regulations: Regulation[];
}

interface VerifySummary {
  regulationName: string;
  versionNumber: string;
  status: VersionStatus;
  fileName: string;
}

const fieldClass = `w-full rounded-md border border-slate-500 bg-white px-3 py-2 text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600 ${focusRing}`;
const labelClass = "mb-1 block font-medium text-slate-900";

export default function VerifyForm({ regulations }: VerifyFormProps) {
  const [regulationSlug, setRegulationSlug] = useState("");
  const [versionNumber, setVersionNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<VerifySummary | null>(null);

  const selectedRegulation = regulations.find(
    (regulation) => regulation.slug === regulationSlug,
  );
  const selectedVersion = selectedRegulation?.versions.find(
    (version) => version.versionNumber === versionNumber,
  );

  // Versi bergantung pada regulasi, jadi pilihan versi lama di-reset agar
  // tidak tersisa nomor versi milik regulasi lain.
  function handleRegulationChange(slug: string) {
    setRegulationSlug(slug);
    setVersionNumber("");
    setResult(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRegulation || !selectedVersion || !file) return;
    setResult({
      regulationName: selectedRegulation.name,
      versionNumber: selectedVersion.versionNumber,
      status: selectedVersion.status,
      fileName: file.name,
    });
  }

  return (
    <div className="space-y-6">
      <form
        noValidate
        onSubmit={handleSubmit}
        className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div>
          <label htmlFor="regulasi" className={labelClass}>
            Regulasi
          </label>
          <select
            id="regulasi"
            value={regulationSlug}
            onChange={(event) => handleRegulationChange(event.target.value)}
            className={fieldClass}
          >
            <option value="">Pilih regulasi</option>
            {regulations.map((regulation) => (
              <option key={regulation.slug} value={regulation.slug}>
                {regulation.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="versi" className={labelClass}>
            Versi
          </label>
          <select
            id="versi"
            value={versionNumber}
            onChange={(event) => setVersionNumber(event.target.value)}
            disabled={!selectedRegulation}
            className={fieldClass}
          >
            <option value="">
              {selectedRegulation ? "Pilih versi" : "Pilih regulasi terlebih dahulu"}
            </option>
            {selectedRegulation?.versions.map((version) => (
              <option key={version.versionNumber} value={version.versionNumber}>
                {version.versionNumber} ({version.status})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="berkas" className={labelClass}>
            Dokumen PDF
          </label>
          <input
            id="berkas"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className={`${fieldClass} file:mr-3 file:rounded file:border-0 file:bg-slate-200 file:px-3 file:py-1 file:text-slate-900`}
          />
        </div>

        <button
          type="submit"
          className={`rounded-md bg-blue-800 px-5 py-2 font-semibold text-white hover:bg-blue-900 ${focusRing}`}
        >
          Verifikasi
        </button>
      </form>

      {result && <VerifyResult {...result} />}
    </div>
  );
}
