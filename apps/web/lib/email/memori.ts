import type { PengirimEmail, PesanEmail } from "./pengirim";

export interface PengirimMemori extends PengirimEmail {
  readonly pesan: PesanEmail[];
  kosongkan(): void;
}

export function buatPengirimMemori(): PengirimMemori {
  const pesan: PesanEmail[] = [];
  return {
    pesan,
    async kirim(p) {
      pesan.push(p);
    },
    kosongkan() {
      pesan.length = 0;
    },
  };
}
