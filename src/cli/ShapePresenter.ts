import type { Circle, Document, Ellipse, Group, Line, Rect, Shape, ShapeVisitor, Text } from "../domain/index.js";

export interface ShapeDescription {
  readonly geometry: string;
  readonly treeGeometry: string;
  readonly position?: string;
  readonly text?: string;
}

export class ShapePresenter implements ShapeVisitor<ShapeDescription> {
  public label(shape: Shape): string { return `${shape.kind}#${shape.id}`; }

  public parent(shape: Shape): string { return shape.parent === null ? "svg" : this.label(shape.parent); }

  public styles(shape: Shape): string {
    return [
      shape.fill === undefined ? "" : `fill=${shape.fill}`,
      shape.stroke === undefined ? "" : `stroke=${shape.stroke}`,
      shape.strokeWidth === undefined ? "" : `stroke-width=${shape.strokeWidth}`,
    ].filter(Boolean).join(" ");
  }

  public describe(shape: Shape): ShapeDescription { return shape.accept(this); }

  public tree(document: Document, id?: string): string[] {
    const lines: string[] = [];
    const inline = (shape: Shape): string => {
      const details = [this.describe(shape).treeGeometry, this.styles(shape)].filter(Boolean).join(" ");
      return this.label(shape) + (details ? `  ${details}` : "");
    };
    const children = (shapes: readonly Shape[], prefix: string): void => {
      shapes.forEach((shape, index) => {
        const last = index === shapes.length - 1;
        lines.push(`${prefix}${last ? "└── " : "├── "}${inline(shape)}`);
        children(shape.children, prefix + (last ? "    " : "│   "));
      });
    };
    if (id === undefined) {
      lines.push(`svg (${document.width}x${document.height})`);
      children(document.children, "");
    } else {
      const root = document.requireShape(id);
      lines.push(inline(root));
      children(root.children, "");
    }
    return lines;
  }

  public show(shape: Shape): string[] {
    const description = this.describe(shape);
    const details = [description.geometry,
      description.text === undefined ? "" : `text=${JSON.stringify(description.text)}`,
      this.styles(shape)].filter(Boolean);
    return [`${this.label(shape)}  parent=${this.parent(shape)}`, ...details.map((line) => `  ${line}`)];
  }

  public visitRect(shape: Rect): ShapeDescription {
    return {
      geometry: `x=${shape.x} y=${shape.y} width=${shape.width} height=${shape.height}`,
      treeGeometry: `x=${shape.x} y=${shape.y} w=${shape.width} h=${shape.height}`,
      position: `(${shape.x},${shape.y})`,
    };
  }

  public visitCircle(shape: Circle): ShapeDescription {
    const geometry = `cx=${shape.cx} cy=${shape.cy} r=${shape.r}`;
    return { geometry, treeGeometry: geometry, position: `(${shape.cx},${shape.cy})` };
  }

  public visitEllipse(shape: Ellipse): ShapeDescription {
    const geometry = `cx=${shape.cx} cy=${shape.cy} rx=${shape.rx} ry=${shape.ry}`;
    return { geometry, treeGeometry: geometry, position: `(${shape.cx},${shape.cy})` };
  }

  public visitLine(shape: Line): ShapeDescription {
    return {
      geometry: `x1=${shape.x1} y1=${shape.y1} x2=${shape.x2} y2=${shape.y2}`,
      treeGeometry: `(${shape.x1},${shape.y1}) -> (${shape.x2},${shape.y2})`,
    };
  }

  public visitText(shape: Text): ShapeDescription {
    return { geometry: `x=${shape.x} y=${shape.y}`, treeGeometry: `(${shape.x},${shape.y}) ${JSON.stringify(shape.content)}`,
      position: `(${shape.x},${shape.y})`, text: shape.content };
  }

  public visitGroup(_shape: Group): ShapeDescription { return { geometry: "", treeGeometry: "" }; }
}
