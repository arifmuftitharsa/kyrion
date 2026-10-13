"use client";

// Satu-satunya Client Component: form butuh state interaktif (pilihan
// regulasi/versi, berkas, galat, hasil) yang tidak bisa ditangani di server.
import { useState, type FormEvent } from "react";
import VerifyResult from "@/components/VerifyResult";
import { focusRing } from "@/lib/styles";
import type { Regulation, VersionStatus } from "@/lib/types";
import {
  MAX_SIZE_MB,
  hasErrors,
  validateVerifyForm,
  type VerifyFormErrors,
} from "@/lib/validation/verify-form";

interface VerifyFormProps {
  regulations: Regulation[];
}

interface VerifySummary {
  regulationName: string;
  versionNumber: string;
  status: VersionStatus;
  fileName: string;
}

const fieldClass = `w-full rounded-md border bg-white px-3 py-2 text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600 ${focusRing}`;
const labelClass = "mb-1 block font-medium text-slate-900";

// Border merah sebagai penanda visual tambahan; pesan teks tetap jadi penanda utama.
function borderClass(error?: string): string {
  return error ? "border-red-700" : "border-slate-500";
}

/** Atribut ARIA yang menghubungkan input dengan pesan galatnya. */
function errorAria(errorId: string, error?: string) {
  return {
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? errorId : undefined,
  };
}

interface FieldErrorProps {
  id: string;
  message?: string;
}

// role="alert" agar pesan galat langsung dibacakan pembaca layar saat muncul.
function FieldError({ id, message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm font-medium text-red-700">
      {message}
    </p>
  );
}

export default function VerifyForm({ regulations }: VerifyFormProps) {
  const [regulationSlug, setRegulationSlug] = useState("");
  const [versionNumber, setVersionNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<VerifyFormErrors>({});
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
    // noValidate + preventDefault: validasi bawaan browser dimatikan agar
    // pesan galat seragam, berbahasa Indonesia, dan aksesibel.
    event.preventDefault();
    const validationErrors = validateVerifyForm({ regulationSlug, versionNumber, file });
    setErrors(validationErrors);

    if (hasErrors(validationErrors) || !selectedRegulation || !selectedVersion || !file) {
      setResult(null);
      return;
    }

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
            className={`${fieldClass} ${borderClass(errors.regulationSlug)}`}
            {...errorAria("regulasi-galat", errors.regulationSlug)}
          >
            <option value="">Pilih regulasi</option>
            {regulations.map((regulation) => (
              <option key={regulation.slug} value={regulation.slug}>
                {regulation.name}
              </option>
            ))}
          </select>
          <FieldError id="regulasi-galat" message={errors.regulationSlug} />
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
            className={`${fieldClass} ${borderClass(errors.versionNumber)}`}
            {...errorAria("versi-galat", errors.versionNumber)}
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
          <FieldError id="versi-galat" message={errors.versionNumber} />
        </div>

        <div>
          <label htmlFor="berkas" className={labelClass}>
            Dokumen PDF{" "}
            <span className="font-normal text-slate-600">(maks. {MAX_SIZE_MB} MB)</span>
          </label>
          <input
            id="berkas"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className={`${fieldClass} ${borderClass(errors.file)} file:mr-3 file:rounded file:border-0 file:bg-slate-200 file:px-3 file:py-1 file:text-slate-900`}
            {...errorAria("berkas-galat", errors.file)}
          />
          <FieldError id="berkas-galat" message={errors.file} />
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
