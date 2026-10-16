import { describe, it, expect } from "vitest";
import { filho, filhos, lerXml, num, procurar, txt } from "../importar/xml";
import { importarCronograma, paraEtapas } from "../importar";
import { lerData } from "../importar/formato";
import { ehXer, lerTabelas } from "../importar/xer";
import { ehMspdi } from "../importar/mspdi";

// ------------------------------------------------------------ XML ----

describe("leitor de XML", () => {
  it("lê elemento, texto e aninhamento", () => {
    const r = lerXml(`<a><b>oi</b><c><d>2</d></c></a>`);
    expect(r.nome).toBe("a");
    expect(txt(r, "b")).toBe("oi");
    expect(num(filho(r, "c"), "d")).toBe(2);
  });

  it("lê atributos com aspas simples e duplas", () => {
    const r = lerXml(`<a x="1" y='dois' z=3><b/></a>`);
    expect(r.atributos.x).toBe("1");
    expect(r.atributos.y).toBe("dois");
  });

  it("aceita elemento vazio", () => {
    const r = lerXml(`<a><b/><c /></a>`);
    expect(r.filhos.map((f) => f.nome)).toEqual(["b", "c"]);
  });

  it("decodifica as entidades padrão e numéricas", () => {
    const r = lerXml(`<a><b>Concretagem &amp; cura &lt;laje&gt; &#65; &#x42;</b></a>`);
    expect(txt(r, "b")).toBe("Concretagem & cura <laje> A B");
  });

  it("pula declaração, comentário e DOCTYPE", () => {
    const r = lerXml(`<?xml version="1.0"?><!-- nota --><!DOCTYPE a><a><b>x</b></a>`);
    expect(txt(r, "b")).toBe("x");
  });

  it("lê CDATA como texto", () => {
    const r = lerXml(`<a><b><![CDATA[ <não é tag> ]]></b></a>`);
    expect(txt(r, "b")).toBe("<não é tag>");
  });

  it("descarta o prefixo de namespace", () => {
    const r = lerXml(`<ms:Project xmlns:ms="x"><ms:Name>Obra</ms:Name></ms:Project>`);
    expect(r.nome).toBe("Project");
    expect(txt(r, "Name")).toBe("Obra");
  });

  it("acha descendente em qualquer profundidade", () => {
    const r = lerXml(`<a><b><c><d>fundo</d></c></b></a>`);
    expect(procurar(r, "d")?.texto).toBe("fundo");
  });

  it("recusa arquivo sem raiz", () => {
    expect(() => lerXml("   ")).toThrow(/sem elemento raiz/);
  });

  it("devolve vários filhos de mesmo nome", () => {
    const r = lerXml(`<a><t>1</t><t>2</t><t>3</t></a>`);
    expect(filhos(r, "t").map((f) => f.texto)).toEqual(["1", "2", "3"]);
  });
});

// -------------------------------------------------------- MS Project --

const MSPDI = `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Residencial Alfa</Name>
  <Tasks>
    <Task>
      <UID>1</UID><Name>Obra</Name><OutlineLevel>1</OutlineLevel>
      <Start>2026-01-01T08:00:00</Start><Finish>2026-06-30T17:00:00</Finish>
      <Summary>1</Summary><PercentComplete>20</PercentComplete><Cost>0</Cost>
    </Task>
    <Task>
      <UID>2</UID><Name>Fundação</Name><OutlineLevel>2</OutlineLevel>
      <Start>2026-01-01T08:00:00</Start><Finish>2026-01-31T17:00:00</Finish>
      <Summary>0</Summary><PercentComplete>100</PercentComplete><Cost>50000</Cost>
    </Task>
    <Task>
      <UID>3</UID><Name>Estrutura</Name><OutlineLevel>2</OutlineLevel>
      <Start>2026-02-01T08:00:00</Start><Finish>2026-04-30T17:00:00</Finish>
      <Summary>0</Summary><PercentComplete>40</PercentComplete><Cost>180000</Cost>
      <PredecessorLink>
        <PredecessorUID>2</PredecessorUID><Type>1</Type>
        <LinkLag>2400</LinkLag><LagFormat>7</LagFormat>
      </PredecessorLink>
    </Task>
    <Task>
      <UID>4</UID><Name>Vistoria</Name><OutlineLevel>2</OutlineLevel>
      <Start>2026-04-30T17:00:00</Start><Finish>2026-04-30T17:00:00</Finish>
      <Milestone>1</Milestone><Summary>0</Summary><PercentComplete>0</PercentComplete>
      <PredecessorLink><PredecessorUID>3</PredecessorUID><Type>1</Type></PredecessorLink>
    </Task>
    <Task>
      <UID>5</UID><Name>Sem data</Name><OutlineLevel>2</OutlineLevel>
      <Summary>0</Summary>
    </Task>
  </Tasks>
</Project>`;

describe("importar MS Project", () => {
  const c = importarCronograma(MSPDI);

  it("reconhece o formato e o nome do projeto", () => {
    expect(ehMspdi(MSPDI)).toBe(true);
    expect(c.origem).toBe("MS Project (XML)");
    expect(c.nomeProjeto).toBe("Residencial Alfa");
  });

  it("traz as tarefas com data e ignora as sem", () => {
    expect(c.tarefas).toHaveLength(4);
    expect(c.avisos.join(" ")).toMatch(/1 tarefa\(s\) sem data/);
  });

  it("reconstrói a hierarquia pelo nível de tópico", () => {
    const porNome = Object.fromEntries(c.tarefas.map((t) => [t.nome, t]));
    expect(porNome["Obra"].chavePai).toBeNull();
    expect(porNome["Fundação"].chavePai).toBe("1");
    expect(porNome["Estrutura"].chavePai).toBe("1");
  });

  it("marca tarefa de resumo e marco", () => {
    const porNome = Object.fromEntries(c.tarefas.map((t) => [t.nome, t]));
    expect(porNome["Obra"].ehResumo).toBe(true);
    expect(porNome["Vistoria"].ehMarco).toBe(true);
    expect(porNome["Fundação"].ehResumo).toBe(false);
  });

  it("lê datas, avanço e custo", () => {
    const f = c.tarefas.find((t) => t.nome === "Fundação")!;
    expect(f.inicio.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(f.fim.toISOString().slice(0, 10)).toBe("2026-01-31");
    expect(f.percentual).toBe(100);
    expect(f.valor).toBe(50000);
  });

  it("converte o tipo de vínculo e a folga para dias", () => {
    const d = c.dependencias.find((x) => x.sucessora === "3")!;
    expect(d.predecessora).toBe("2");
    expect(d.tipo).toBe("TI");
    // 2400 décimos de minuto = 240 min = 5 dias de 8 h… não: 240/480 = 0,5 → 1
    expect(d.folgaDias).toBe(1);
  });

  it("traduz os quatro tipos do MS Project", () => {
    const monta = (tipo: string) => importarCronograma(MSPDI.replace("<Type>1</Type>", `<Type>${tipo}</Type>`))
      .dependencias.find((d) => d.sucessora === "3")!.tipo;
    expect(monta("0")).toBe("TT");
    expect(monta("1")).toBe("TI");
    expect(monta("2")).toBe("IT");
    expect(monta("3")).toBe("II");
  });

  it("descarta dependência que aponta para fora do arquivo", () => {
    const c2 = importarCronograma(MSPDI.replace("<PredecessorUID>2</PredecessorUID>", "<PredecessorUID>999</PredecessorUID>"));
    expect(c2.dependencias.every((d) => d.predecessora !== "999")).toBe(true);
    expect(c2.avisos.join(" ")).toMatch(/fora do arquivo/);
  });
});

// --------------------------------------------------------------- XER --

const XER = [
  "ERMHDR\t19.12\t2026-01-05\tProject\tadmin",
  "%T\tPROJECT",
  "%F\tproj_id\tproj_short_name\tproj_name",
  "%R\t100\tALFA\tResidencial Alfa",
  "%T\tPROJWBS",
  "%F\twbs_id\tproj_id\twbs_name",
  "%R\t900\t100\tEdificação",
  "%T\tTASK",
  "%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\ttask_type\ttarget_start_date\ttarget_end_date\tphys_complete_pct\ttarget_cost",
  "%R\t1\t100\t900\tA1000\tFundação\tTT_Task\t2026-01-01 08:00\t2026-01-31 17:00\t100\t50000",
  "%R\t2\t100\t900\tA1010\tEstrutura\tTT_Task\t2026-02-01 08:00\t2026-04-30 17:00\t40\t180000",
  "%R\t3\t100\t900\tM100\tVistoria\tTT_Mile\t2026-04-30 17:00\t2026-04-30 17:00\t0\t0",
  "%R\t4\t100\t900\tX\tSem data\tTT_Task\t\t\t0\t0",
  "%T\tTASKPRED",
  "%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt",
  "%R\t5000\t2\t1\tPR_FS\t16",
  "%R\t5001\t3\t2\tPR_FS\t0",
  "%R\t5002\t2\t999\tPR_SS\t0",
].join("\n");

describe("importar Primavera P6", () => {
  const c = importarCronograma(XER);

  it("reconhece o formato e o nome do projeto", () => {
    expect(ehXer(XER)).toBe(true);
    expect(c.origem).toBe("Primavera P6 (XER)");
    expect(c.nomeProjeto).toBe("ALFA");
  });

  it("separa as tabelas do arquivo", () => {
    const t = lerTabelas(XER);
    expect([...t.keys()]).toEqual(["PROJECT", "PROJWBS", "TASK", "TASKPRED"]);
    expect(t.get("TASK")!.linhas).toHaveLength(4);
  });

  it("ignora atividade sem data e avisa", () => {
    expect(c.tarefas.filter((t) => !t.ehResumo)).toHaveLength(3);
    expect(c.avisos.join(" ")).toMatch(/1 atividade\(s\) sem data/);
  });

  it("transforma a WBS em etapa-pai com datas das filhas", () => {
    const pai = c.tarefas.find((t) => t.ehResumo)!;
    expect(pai.nome).toBe("Edificação");
    expect(pai.inicio.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(pai.fim.toISOString().slice(0, 10)).toBe("2026-04-30");
    expect(pai.valor).toBe(0); // o valor é das filhas
  });

  it("reconhece marco pelo tipo de atividade", () => {
    expect(c.tarefas.find((t) => t.nome === "Vistoria")!.ehMarco).toBe(true);
    expect(c.tarefas.find((t) => t.nome === "Fundação")!.ehMarco).toBe(false);
  });

  it("converte folga de horas para dias", () => {
    const d = c.dependencias.find((x) => x.sucessora === "2" && x.predecessora === "1")!;
    expect(d.tipo).toBe("TI");
    expect(d.folgaDias).toBe(2); // 16 h / 8
  });

  it("descarta vínculo com atividade que não veio no arquivo", () => {
    expect(c.dependencias.every((d) => d.predecessora !== "999")).toBe(true);
    expect(c.dependencias).toHaveLength(2);
  });
});

// ---------------------------------------------------------- comuns ----

describe("detecção de formato", () => {
  it("explica o que fazer com .mpp em vez de falhar seco", () => {
    expect(() => importarCronograma("PK\x03\x04qualquer coisa binária")).toThrow(/Salvar como → XML/);
  });
  it("recusa texto qualquer", () => {
    expect(() => importarCronograma("oi, tudo bem?")).toThrow(/não reconhecido/);
  });
});

describe("datas", () => {
  it("entende ISO e o formato com espaço do P6", () => {
    expect(lerData("2026-03-01T08:00:00")!.toISOString().slice(0, 10)).toBe("2026-03-01");
    expect(lerData("2026-03-01 08:00")!.toISOString().slice(0, 10)).toBe("2026-03-01");
  });
  it("devolve null para vazio ou lixo", () => {
    expect(lerData("")).toBeNull();
    expect(lerData("não é data")).toBeNull();
  });
});

describe("preparo para o banco", () => {
  it("ordena pai antes de filha", () => {
    const etapas = paraEtapas(importarCronograma(MSPDI));
    const posPai = etapas.findIndex((e) => e.chave === "1");
    const posFilha = etapas.findIndex((e) => e.chave === "2");
    expect(posPai).toBeLessThan(posFilha);
  });

  it("zera valor e avanço da etapa-pai, que são soma das filhas", () => {
    const etapas = paraEtapas(importarCronograma(MSPDI));
    const pai = etapas.find((e) => e.chave === "1")!;
    expect(pai.valorOrcado).toBe(0);
    expect(pai.percentual).toBe(0);
  });

  it("numera a ordem em sequência", () => {
    const etapas = paraEtapas(importarCronograma(MSPDI));
    expect(etapas.map((e) => e.ordem)).toEqual([1, 2, 3, 4]);
  });

  it("corta nome muito longo em vez de estourar a coluna", () => {
    const longo = MSPDI.replace("<Name>Fundação</Name>", `<Name>${"x".repeat(300)}</Name>`);
    const etapas = paraEtapas(importarCronograma(longo));
    expect(Math.max(...etapas.map((e) => e.nome.length))).toBeLessThanOrEqual(120);
  });

  it("ignora referência a pai que não existe", () => {
    const c = importarCronograma(XER);
    const etapas = paraEtapas(c);
    const chaves = new Set(etapas.map((e) => e.chave));
    expect(etapas.every((e) => e.chavePai === null || chaves.has(e.chavePai))).toBe(true);
  });
});
