"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

export function ImprimirBotao() {
  return <Button onClick={() => window.print()}><Printer size={18} aria-hidden /> Imprimir ou salvar em PDF</Button>;
}
