import type { Metadata } from "next";
import { Apresentacao } from "./slides";

export const metadata: Metadata = { title: "Apresentação" };

// Pública de propósito (liberada no middleware): é o material comercial do sistema.
export default function ApresentacaoPage() {
  return <Apresentacao />;
}
