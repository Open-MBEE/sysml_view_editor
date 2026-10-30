import type { ModelSnapshot } from '../project';
import type { EvaluatedView } from '../views';
import type { SemanticCommand } from './index';

export interface PortEndpoint {
  readonly usage: string;
  readonly port: string;
  readonly symbol: string;
  readonly type: string;
  readonly direction: 'in' | 'out' | 'inout';
}

/** Resolve each displayed port through its complete, engine-provided usage. */
export function structuralPorts(
  model: ModelSnapshot,
  view: EvaluatedView | null,
): PortEndpoint[] {
  if (
    view?.status !== 'complete' ||
    view.renderStatus !== 'available' ||
    view.artifact?.kind !== 'interconnection' ||
    view.modelHash !== model.modelHash
  )
    return [];
  const ports: PortEndpoint[] = [];
  for (const node of view.artifact.nodes) {
    const owners = view.correspondence.filter(
      (entry) => entry.symbol === node.id,
    );
    if (owners.length !== 1 || !owners[0]!.subject.qualifiedName) continue;
    const owner = owners[0]!;
    if (
      !model.elements.some(
        (item) =>
          item.id === owner.subject.qualifiedName && item.kind === 'partUsage',
      )
    )
      continue;
    for (const port of node.ports ?? []) {
      const matches = view.correspondence.filter(
        (entry) => entry.symbol === port.id,
      );
      if (
        matches.length !== 1 ||
        !port.direction ||
        !port.type ||
        port.type.includes('~')
      )
        continue;
      if (
        !/^[A-Za-z_]\w*$/.test(port.name) ||
        !/^[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*$/.test(owner.subject.qualifiedName!)
      )
        continue;
      const correspondence = matches[0]!;
      if (
        JSON.stringify(correspondence.context.slice(0, -1)) !==
        JSON.stringify(owner.context)
      )
        continue;
      const declaration = model.elements.find(
        (item) => item.id === correspondence.subject.qualifiedName,
      );
      if (declaration?.kind !== 'portUsage' || !declaration.typeId) continue;
      ports.push({
        usage: owner.subject.qualifiedName!,
        port: port.name,
        symbol: port.id,
        type: declaration.typeId,
        direction: port.direction,
      });
    }
  }
  // A declaration inherited through several indistinguishable source paths is
  // not a supported authoring endpoint until an explicit path can be resolved.
  return ports.filter(
    (port) =>
      ports.filter(
        (other) => other.usage === port.usage && other.port === port.port,
      ).length === 1,
  );
}

export function compatiblePorts(from: PortEndpoint, to: PortEndpoint): boolean {
  return (
    (from.usage !== to.usage || from.port !== to.port) &&
    from.type === to.type &&
    ['out', 'inout'].includes(from.direction) &&
    ['in', 'inout'].includes(to.direction)
  );
}

export function validateCreation(
  model: ModelSnapshot,
  command: SemanticCommand,
): void {
  if (command.kind !== 'createPart' && command.kind !== 'connectPorts') return;
  const owner = model.elements.find((item) => item.id === command.owner);
  if (!owner || !['package', 'partDef', 'partUsage'].includes(owner.kind))
    throw new Error('Choose an existing package or part owner.');
  if (
    model.elements.some(
      (item) => item.id === command.owner + '::' + command.name,
    )
  )
    throw new Error('That name already exists in the selected owner.');
  if (
    command.kind === 'createPart' &&
    !model.elements.some(
      (item) => item.id === command.type && item.kind === 'partDef',
    )
  )
    throw new Error('Choose an existing part definition.');
}

export function validateConnection(
  model: ModelSnapshot,
  view: EvaluatedView,
  command: Extract<SemanticCommand, { kind: 'connectPorts' }>,
): void {
  const ports = structuralPorts(model, view);
  const from = ports.filter(
    (item) =>
      item.usage === command.from.usage && item.port === command.from.port,
  );
  const to = ports.filter(
    (item) => item.usage === command.to.usage && item.port === command.to.port,
  );
  if (
    from.length !== 1 ||
    to.length !== 1 ||
    !compatiblePorts(from[0]!, to[0]!)
  )
    throw new Error(
      'Choose distinct, explicitly directed ports of the same resolved type (out/inout to in/inout).',
    );
  if (
    ![command.from.usage, command.to.usage].every((usage) =>
      usage.startsWith(command.owner + '::'),
    )
  )
    throw new Error('The connection owner must contain both endpoint usages.');
}

export function checkConnectionResult(
  model: ModelSnapshot,
  view: EvaluatedView,
  command: Extract<SemanticCommand, { kind: 'connectPorts' }>,
): void {
  validateConnection(model, view, command);
  const artifact = view.artifact!;
  const connections = artifact.edges.filter((edge, index) => {
    const correspondence = view.correspondence.find(
      (item) => item.symbol === `edge:${index}`,
    );
    if (
      correspondence?.subject.qualifiedName !==
      command.owner + '::' + command.name
    )
      return false;
    const fromNode = artifact.nodes.find((node) => node.id === edge.from);
    const toNode = artifact.nodes.find((node) => node.id === edge.to);
    return (
      view.correspondence.find((item) => item.symbol === edge.from)?.subject
        .qualifiedName === command.from.usage &&
      view.correspondence.find((item) => item.symbol === edge.to)?.subject
        .qualifiedName === command.to.usage &&
      fromNode?.ports?.find((port) => port.id === edge.fromPort)?.name ===
        command.from.port &&
      toNode?.ports?.find((port) => port.id === edge.toPort)?.name ===
        command.to.port
    );
  });
  if (connections.length !== 1)
    throw new Error(
      'The engine did not resolve the requested connection to the intended usage endpoints.',
    );
}
