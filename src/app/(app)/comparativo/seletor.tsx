"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";

export function Seletor({ obras, selecionadas, max }: {
  obras: { id: string; nome: string }[];
  selecionadas: string[];
  max: number;
}) {
  const router = useRouter();
  const [marcadas, setMarcadas] = useState<string[]>(selecionadas);

  const alternar = (id: string) =>
    setMarcadas((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : atual.length >= max ? atual : [...atual, id],
    );

  const cheio = marcadas.length >= max;

  return (
    <Card className="p-4">
      <h2 className="font-display text-lg font-semibold">Obras a comparar</h2>
      <p className="mt-1 text-sm text-muted">
        {marcadas.length} de {max} escolhidas.
        {cheio && " Desmarque uma para trocar."}
      </p>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {obras.map((o) => {
          const marcada = marcadas.includes(o.id);
          return (
            <li key={o.id}>
              <label className={`flex min-h-11 cursor-pointer items-center gap-2 rounded border p-2 text-sm ${
                marcada ? "border-laranja bg-laranja/5" : "border-line"} ${
                !marcada && cheio ? "opacity-50" : ""}`}>
                <input
                  type="checkbox" className="h-4 w-4 accent-laranja"
                  checked={marcada} disabled={!marcada && cheio}
                  onChange={() => alternar(o.id)}
                />
                <span className="min-w-0 flex-1 truncate">{o.nome}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex gap-2">
        <Button
          disabled={marcadas.length === 0}
          onClick={() => router.push(`/comparativo?obras=${marcadas.join(",")}`)}
        >
          Comparar
        </Button>
        {marcadas.length > 0 && (
          <Button variante="contorno" onClick={() => setMarcadas([])}>Limpar</Button>
        )}
      </div>
    </Card>
  );
}
