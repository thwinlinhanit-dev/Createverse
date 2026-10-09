/**
 * cv/no-raw-text — blocks raw user-visible strings in UI code.
 *
 * Spec: ARCHITECTURE.md ("All user-visible text uses t(\"key\"). A lint rule
 * blocks raw strings in UI code."), task P1-02 (ACCEPTANCE: lint fails on a
 * raw string), ADR-0008.
 *
 * What it reports in every TSX file:
 *  1. JSX text containing letters:            <h2>Home</h2>
 *  2. String/template literals that reach the UI — a literal (optionally
 *     inside ternaries/logicals) whose boundary is a JSX expression
 *     container or JSX attribute:              {isEn ? "Home" : "首頁"}
 *                                              <Chip label="No creations" />
 *  3. Object values under text-bearing keys:   { label: "Junior" }
 *
 * What it deliberately allows (code, not copy):
 *  - t("key") call arguments and any other call arguments (routes, hashes);
 *  - identifiers/config: const brand = "Createverse", classNames, ids, types,
 *    roles, SVG attributes, aria-* IDREFs, icon names;
 *  - letters-only check means numeric or punctuation-only text ("·", "0")
 *    still renders fine without a key.
 *
 * Scope note: data that happens to flow into the UI later (a table of labels
 * in a .ts module) is out of this rule's reach — that is what the catalog-key
 * convention and code review are for.
 */

/** JSX attributes whose string values are code/identifiers, never visible copy. */
const ALLOWED_ATTRS = new Set([
  // markup / styling / routing
  "className", "id", "type", "role", "href", "htmlFor", "key", "lang", "langKey",
  "name", "value", "size", "align", "variant", "kind", "icon", "hash", "route",
  "stage", "as", "target", "rel", "stroke", "fill", "viewBox", "xmlns",
  // media wiring (paths/enum tokens, never visible copy — P1-13 captions hook)
  "preload", "src", "mimeType", "captionsSrc",
  "strokeLinecap", "strokeLinejoin", "strokeMiterlimit", "strokeOpacity",
  "strokeWidth", "fillRule", "fillOpacity", "clipRule", "clipPath",
  "vectorEffect", "shapeRendering", "pointerEvents",
  // aria IDREFs and state flags (IDs/state, not text)
  "aria-labelledby", "aria-describedby", "aria-controls", "aria-current",
  "aria-hidden", "aria-modal", "aria-pressed", "aria-live", "aria-expanded",
  "aria-haspopup", "aria-orientation", "aria-selected", "aria-disabled",
]);

/** Object property keys whose values are visible copy when fed to components. */
const TEXT_KEYS = new Set([
  "label", "title", "placeholder", "alt", "text", "heading", "description",
  "children", "message", "caption", "body", "ariaLabel",
]);

const WRAPPERS = new Set([
  "ConditionalExpression",
  "LogicalExpression",
  "TSAsExpression",
  "TSNonNullExpression",
  "TSInstantiationExpression",
  "ChainExpression",
  "AwaitExpression",
]);

function hasLetters(text) {
  return /\p{L}/u.test(text);
}

function snippet(text) {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 48 ? `${oneLine.slice(0, 45)}…` : oneLine;
}

function attrName(attribute) {
  return attribute.name && attribute.name.type === "JSXIdentifier"
    ? attribute.name.name
    : "";
}

/** Walks ternaries/logicals/templates; returns the boundary and the top node reached. */
function boundaryOf(node) {
  let current = node;
  for (;;) {
    const parent = current.parent;
    if (!parent) return null;
    if (WRAPPERS.has(parent.type)) {
      current = parent;
      continue;
    }
    if (parent.type === "TemplateLiteral") {
      current = parent;
      continue;
    }
    return { boundary: parent, top: current };
  }
}

export const noRawText = {
  meta: {
    type: "problem",
    docs: {
      description:
        'Disallow raw user-visible strings in UI code; use t("key") from packages/i18n (ADR-0008, P1-02).',
    },
    schema: [],
    messages: {
      rawText:
        'Raw UI text "{{text}}" — move it to a packages/i18n catalog and render t("key").',
    },
  },
  create(context) {
    function report(node, text) {
      // messageId + data: ESLint 9 does not interpolate `message` directly.
      context.report({ node, messageId: "rawText", data: { text: snippet(text) } });
    }

    function checkExpressionString(node) {
      const text = node.type === "TemplateElement" ? node.value.cooked : node.value;
      if (typeof text !== "string" || !hasLetters(text)) return;

      const hit = boundaryOf(node);
      if (!hit) return;
      const { boundary, top } = hit;
      if (boundary.type === "JSXExpressionContainer") {
        // A container that is an attribute's value: allow code-valued props
        // (className templates, role/aria-current tokens, data-*).
        const attribute = boundary.parent;
        if (attribute && attribute.type === "JSXAttribute") {
          const name = attrName(attribute);
          if (name.startsWith("data-") || ALLOWED_ATTRS.has(name)) return;
        }
        report(node, text);
        return;
      }
      if (boundary.type === "JSXAttribute") {
        const name = attrName(boundary);
        if (name.startsWith("data-") || ALLOWED_ATTRS.has(name)) return;
        report(node, text);
        return;
      }
      if (
        boundary.type === "Property" &&
        !boundary.computed &&
        boundary.value === top &&
        TEXT_KEYS.has(boundary.key.name ?? "")
      ) {
        report(node, text);
      }
    }

    return {
      JSXText(node) {
        if (hasLetters(node.value)) report(node, node.value);
      },
      Literal: checkExpressionString,
      TemplateElement: checkExpressionString,
    };
  },
};

export default noRawText;
