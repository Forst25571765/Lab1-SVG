import { DOMParser, Node, type Document as XmlDocument, type Element } from "@xmldom/xmldom";
import type { SvgReadResult, SvgReaderPort } from "../application/ports/SvgReaderPort.js";
import { Document, Group, ShapeFactory, type Shape } from "../domain/index.js";
import { duplicateId } from "../domain/errors.js";
import { SvgFormatError } from "./SvgFormatError.js";
import { SVG_NAMESPACE, XMLNS_NAMESPACE } from "./svgNamespace.js";

export class SvgReader implements SvgReaderPort {
  private static readonly numericAttributes = new Set([
    "x", "y", "width", "height", "cx", "cy", "r", "rx", "ry", "x1", "y1", "x2", "y2", "stroke-width",
  ]);
  private static readonly rootAttributes = new Set(["width", "height", "viewBox", "version"]);

  public constructor(private readonly factory = new ShapeFactory()) {}

  public read(source: string): SvgReadResult {
    const xml = this.parse(source);
    const root = xml.documentElement;
    if (root === null || root.localName !== "svg" || (root.namespaceURI !== null && root.namespaceURI !== SVG_NAMESPACE)) {
      throw new SvgFormatError("expected an SVG root element");
    }
    this.assertDocumentNodes(xml);
    this.assertAttributes(root, SvgReader.rootAttributes);
    const width = this.number(root.getAttribute("width"), "width");
    const height = this.number(root.getAttribute("height"), "height");
    this.assertViewBox(root, width, height);

    const elements = Array.from(root.getElementsByTagName("*"));
    const reservedIds = new Set<string>();
    for (const element of elements) {
      if (element.namespaceURI !== root.namespaceURI) {
        throw new SvgFormatError(`unsupported namespace on <${element.tagName}>`);
      }
      const id = element.getAttribute("id");
      if (id !== null && id.trim().length > 0) {
        if (reservedIds.has(id)) throw duplicateId(id);
        reservedIds.add(id);
      }
    }

    const warnings: string[] = [];
    const nextNumbers = new Map<string, number>();
    const assignId = (element: Element): string => {
      const explicit = element.getAttribute("id");
      if (explicit !== null && explicit.trim().length > 0) return explicit;
      const tag = element.localName ?? element.tagName;
      let number = nextNumbers.get(tag) ?? 1;
      while (reservedIds.has(`${tag}${number}`)) number++;
      const id = `${tag}${number}`;
      reservedIds.add(id);
      nextNumbers.set(tag, number + 1);
      warnings.push(`warning: assigned id ${id} to unnamed <${tag}>`);
      return id;
    };

    const document = new Document(width, height);
    const readChildren = (element: Element, parent: Group | null): void => {
      this.assertContent(element);
      for (const child of this.elementChildren(element)) {
        const shape = this.readShape(child, assignId(child));
        document.add(shape, parent);
        if (shape instanceof Group) {
          readChildren(child, shape);
        } else if (this.elementChildren(child).length > 0) {
          throw new SvgFormatError(`child elements are not supported in <${child.localName}>`);
        } else {
          this.assertContent(child, shape.getAttribute("text") !== undefined);
        }
      }
    };
    readChildren(root, null);
    return { document, warnings };
  }

  private parse(source: string): XmlDocument {
    try {
      return new DOMParser({ onError: (_level, message) => { throw new Error(message); } })
        .parseFromString(source, "application/xml");
    } catch (cause) {
      throw new SvgFormatError("malformed XML", { cause });
    }
  }

  private readShape(element: Element, id: string): Shape {
    const parameters: Record<string, unknown> = { id, text: element.textContent ?? "" };
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.namespaceURI === XMLNS_NAMESPACE || attribute.name === "id" || attribute.name === "data-kind") {
        continue;
      }
      if (SvgReader.numericAttributes.has(attribute.name)) {
        parameters[attribute.name] = this.number(attribute.value, attribute.name);
      } else if (attribute.name === "fill" || attribute.name === "stroke") {
        parameters[attribute.name] = attribute.value;
      } else {
        throw new SvgFormatError(`unsupported attribute: ${attribute.name} on <${element.localName}>`);
      }
    }
    const shape = this.factory.create(element.localName ?? element.tagName, parameters);
    const allowedAttributes = new Set(["id", "fill", "stroke", "stroke-width", ...Object.keys(shape.getAttributes())]);
    // A plugin marker on an ordinary group degrades to g while preserving its entire subtree.
    if (shape instanceof Group) allowedAttributes.add("data-kind");
    this.assertAttributes(element, allowedAttributes);
    return shape;
  }

  private number(raw: string | null, name: string, allowPx = true): number {
    const value = raw?.trim() ?? "";
    const numericText = allowPx && value.endsWith("px") ? value.slice(0, -2) : value;
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(numericText)
      || !Number.isFinite(Number(numericText))) {
      throw new SvgFormatError(`invalid number for ${name}`);
    }
    return Number(numericText);
  }

  private assertViewBox(root: Element, width: number, height: number): void {
    if (!root.hasAttribute("viewBox")) return;
    const values = (root.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/);
    if (values.length !== 4) throw new SvgFormatError("viewBox requires four numbers");
    const numbers = values.map((value) => this.number(value, "viewBox", false));
    if (numbers.some((value, index) => value !== [0, 0, width, height][index])) {
      throw new SvgFormatError(`unsupported viewBox; expected 0 0 ${width} ${height}`);
    }
  }

  private assertAttributes(element: Element, allowed: ReadonlySet<string>): void {
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.namespaceURI !== XMLNS_NAMESPACE && !allowed.has(attribute.name)) {
        throw new SvgFormatError(`unsupported attribute: ${attribute.name} on <${element.localName}>`);
      }
    }
  }

  private assertDocumentNodes(xml: XmlDocument): void {
    for (const node of Array.from(xml.childNodes)) {
      if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.COMMENT_NODE) continue;
      if (node.nodeType === Node.PROCESSING_INSTRUCTION_NODE && node.nodeName === "xml") continue;
      if (node.nodeType === Node.TEXT_NODE && (node.nodeValue ?? "").trim().length === 0) continue;
      throw new SvgFormatError(`unsupported XML node: ${node.nodeName}`);
    }
  }

  private assertContent(element: Element, allowText = false): void {
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.COMMENT_NODE) continue;
      if ((node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE)
        && (allowText || (node.nodeValue ?? "").trim().length === 0)) continue;
      throw new SvgFormatError(`unsupported content in <${element.localName}>`);
    }
  }

  private elementChildren(element: Element): Element[] {
    return Array.from(element.childNodes).filter((node): node is Element => node.nodeType === Node.ELEMENT_NODE);
  }
}
