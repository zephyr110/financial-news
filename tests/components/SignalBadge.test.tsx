import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SignalBadge from "../../components/SignalBadge";

describe("SignalBadge", () => {
  it("renders score 5 with red badge", () => {
    render(<SignalBadge score={5} />);
    const badge = screen.getByText("5");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-red-600");
  });

  it("renders score 4 with orange badge", () => {
    render(<SignalBadge score={4} />);
    const badge = screen.getByText("4");
    expect(badge.className).toContain("bg-orange-500");
  });

  it("renders score 3 with yellow badge", () => {
    render(<SignalBadge score={3} />);
    const badge = screen.getByText("3");
    expect(badge.className).toContain("bg-yellow-500");
  });

  it("hides score 2 by default (noise reduction)", () => {
    const { container } = render(<SignalBadge score={2} />);
    expect(container.firstChild).toBeNull();
  });

  it("hides score 1 by default", () => {
    const { container } = render(<SignalBadge score={1} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders empty placeholder for score 0 (unanalyzed)", () => {
    render(<SignalBadge score={0} />);
    expect(screen.getByText("○")).toBeInTheDocument();
    expect(screen.getByLabelText("待分析")).toBeInTheDocument();
  });

  it("renders empty placeholder for null score", () => {
    render(<SignalBadge score={null as unknown as number} />);
    expect(screen.getByLabelText("待分析")).toBeInTheDocument();
  });

  it("renders empty placeholder for NaN score", () => {
    render(<SignalBadge score={NaN} />);
    expect(screen.getByLabelText("待分析")).toBeInTheDocument();
  });

  it("applies size classes", () => {
    render(<SignalBadge score={5} size="lg" />);
    const badge = screen.getByText("5");
    expect(badge.className).toContain("w-8");
    expect(badge.className).toContain("h-8");
  });

  it("applies clickable transform classes when clickable", () => {
    render(<SignalBadge score={5} clickable />);
    const badge = screen.getByText("5");
    expect(badge.className).toContain("cursor-pointer");
  });
});
