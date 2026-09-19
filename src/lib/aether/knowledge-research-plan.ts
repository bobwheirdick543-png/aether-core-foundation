export type ResearchAspect = {
  id: string;
  title: string;
  objective: string;
  query: string;
  required: boolean;
};

export function buildKnowledgeResearchAspects(subject: string): ResearchAspect[] {
  const s = subject.trim().slice(0, 300);
  if (!s) throw new Error("Research subject is required");
  return [
    { id: "core", title: "Core definition and identity", objective: `Establish what ${s} is and the defining facts needed to understand it.`, query: `${s} definition identity core facts`, required: true },
    { id: "history", title: "Origin, history and development", objective: `Establish the origin, history and major developments of ${s}.`, query: `${s} origin history major developments timeline`, required: true },
    { id: "capabilities", title: "Capabilities, properties and limitations", objective: `Identify the important capabilities or properties of ${s}, including meaningful limitations and exceptions.`, query: `${s} capabilities properties features limitations exceptions`, required: true },
    { id: "context", title: "Essential context and relationships", objective: `Collect only the surrounding concepts, organizations, people, technologies or events necessary to understand ${s}.`, query: `${s} essential context related concepts organizations relationships`, required: true },
    { id: "terminology", title: "Terminology and concepts", objective: `Identify terminology and definitions required to correctly understand ${s}.`, query: `${s} terminology concepts definitions glossary`, required: true },
    { id: "verification", title: "Verification and unresolved claims", objective: `Cross-check important claims, dates and source quality and identify conflicts or unresolved evidence about ${s}.`, query: `${s} authoritative sources evidence verification conflicting claims recent updates`, required: true },
  ];
}

export function aspectProgress(aspects: ResearchAspect[], completedIds: string[]): number {
  if (!aspects.length) return 0;
  const done = new Set(completedIds);
  return Math.round((aspects.filter((aspect) => done.has(aspect.id)).length / aspects.length) * 100);
}
