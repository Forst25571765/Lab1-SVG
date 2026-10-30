import { DOMImplementation, XMLSerializer, type Document as XmlDocument, type Element } from "@xmldom/xmldom";
import type { SvgWriterPort } from "../application/ports/SvgWriterPort.js";
import type { Document, Shape } from "../domain/index.js";
import { SvgFormatError } from "./SvgFormatError.js";
import { SVG_NAMESPACE } from "./svgNamespace.js";

export class SvgWriter implements SvgWriterPort {
  public write(document: Document): string {
    const xml = new DOMImplementation().createDocument(SVG_NAMESPACE, "svg", null);
    const root = xml.documentElement;
    if (root === null) throw new SvgFormatError("could not create an SVG root element");
    root.setAttribute("width", String(document.width));
    root.setAttribute("height", String(document.height));
    root.setAttribute("viewBox", `0 0 ${document.width} ${document.height}`);
    for (const shape of document.children) {
      root.appendChild(this.writeShape(xml, shape));
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n'
      + new XMLSerializer().serializeToString(xml, { requireWellFormed: true }) + "\n";
  }

  private writeShape(xml: XmlDocument, shape: Shape): Element {
    const element = xml.createElementNS(SVG_NAMESPACE, shape.kind);
    element.setAttribute("id", shape.id);
    for (const [name, value] of Object.entries(shape.getAttributes())) {
      if (name === "text") {
        element.appendChild(xml.createTextNode(String(value)));
      } else {
        element.setAttribute(name, String(value));
      }
    }
    for (const child of shape.children) {
      element.appendChild(this.writeShape(xml, child));
    }
    return element;
  }
}
