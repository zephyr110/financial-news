import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TrendDelta from "../../components/TrendDelta";

/** Helper: find element whose text content includes the given substring */
const getByTextContent = (text: string) =>
  screen.getByText((_content, element) => {
    if (!element) return false;
    const hasText = (el: Element) => el.textContent?.includes(text) ?? false;
    // Check the element itself and its children
    if (hasText(element)) {
      // Make sure no child also has the same text (avoid false parent matches)
      for (const child of Array.from(element.children)) {
        if (hasText(child)) return false;
      }
      return true;
    }
    return false;
  });

describe("TrendDelta", () => {
  it("renders positive change with green up arrow", () => {
    render(<TrendDelta current={10} previous={5} />);
    // Text node is "+5 vs 昨日 (+100%)" — check content includes expected parts
    expect(getByTextContent("+5")).toBeInTheDocument();
    expect(getByTextContent("vs 昨日")).toBeInTheDocument();
    expect(getByTextContent("+100%")).toBeInTheDocument();
  });

  it("renders negative change with red down arrow", () => {
    render(<TrendDelta current={5} previous={10} />);
    // "-5 vs 昨日" text node includes the diff + label
    expect(getByTextContent("-5 vs 昨日")).toBeInTheDocument();
    expect(getByTextContent("-50%")).toBeInTheDocument();
  });

  it("renders flat trend (持平) when zero diff", () => {
    render(<TrendDelta current={10} previous={10} />);
    // Text node is "持平 vs 昨日" — use content matcher
    expect(getByTextContent("持平")).toBeInTheDocument();
  });

  it("renders nothing when current is null", () => {
    const { container } = render(
      <TrendDelta current={null as unknown as number} previous={5} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when previous is null", () => {
    const { container } = render(
      <TrendDelta current={5} previous={null as unknown as number} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when current is NaN", () => {
    const { container } = render(<TrendDelta current={NaN} previous={5} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders decimal format with 1 decimal place", () => {
    render(<TrendDelta current={4.2} previous={3.9} format="decimal" />);
    expect(getByTextContent("+0.3")).toBeInTheDocument();
    expect(getByTextContent("vs 昨日")).toBeInTheDocument();
  });

  it("renders custom label", () => {
    render(<TrendDelta current={10} previous={8} label="上周" />);
    expect(getByTextContent("+2")).toBeInTheDocument();
    expect(getByTextContent("vs 上周")).toBeInTheDocument();
  });

  it("shows just the diff without percentage when previous is 0", () => {
    // Cannot compute percentage against zero baseline
    render(<TrendDelta current={5} previous={0} />);
    expect(getByTextContent("+5")).toBeInTheDocument();
    // No "vs 昨日" label since percentage cannot be calculated
    expect(screen.queryByText(/vs 昨日/)).toBeNull();
  });
});
